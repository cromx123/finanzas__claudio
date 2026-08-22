from __future__ import annotations

import calendar
import logging
import uuid
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.core.cache import cache_get_json, cache_set_json
from app.models.market import DividendEvent, Fundamentals, Price
from app.models.portfolio import Asset, Portfolio, Transaction, TransactionLotAllocation, TransactionType
from app.models.strategy import HoldingTag, Tag
from app.models.user import User, UserTaxRule
from app.modules.assets.service import get_or_create_asset, ingest_full_asset, latest_price, refresh_quote
from app.modules.fx import service as fx_service
from app.modules.ingestion.providers.base import Provider, QuoteResult
from app.modules.portfolios import lots as lots_service
from app.modules.portfolios.lots import InsufficientQuantityError, LotAllocationError
from app.schemas.portfolios import (
    CountryAllocationOut,
    CountryAllocationRow,
    HoldingOut,
    PerformancePointOut,
    PortfolioPerformanceOut,
    PortfolioSummaryOut,
    TransactionImportRow,
    TransactionImportRowResult,
    TransactionOut,
)

logger = logging.getLogger(__name__)

_PERFORMANCE_RANGE_YEARS: dict[str, int] = {"1A": 1, "3A": 3, "5A": 5}
# Short ranges need daily sampling — monthly buckets would collapse a 1-week
# window to a single point. Mapped to a yfinance period with enough buffer
# to always cover the range's start date even across a weekend/holiday run.
_PERFORMANCE_RANGE_DAYS: dict[str, int] = {"1D": 1, "1W": 7, "1M": 30, "3M": 90}
_BENCHMARK_PERIOD_FOR_SHORT_RANGE: dict[str, str] = {"1D": "5d", "1W": "1mo", "1M": "3mo", "3M": "6mo"}
_BENCHMARK_SYMBOL = "^GSPC"


def withholding_for_country(db: Session, user: User, country_code: str) -> float:
    """README business rule #3: retention is looked up per (user, país del
    activo), not stored on the portfolio itself.
    """
    rule = db.scalar(
        select(UserTaxRule).where(UserTaxRule.user_id == user.id, UserTaxRule.country_code == country_code)
    )
    return float(rule.withholding_pct) / 100 if rule else 0.0


class PortfolioNotFoundError(Exception):
    pass


class TransactionNotFoundError(Exception):
    pass


def list_portfolios(db: Session, user: User) -> list[Portfolio]:
    return list(db.scalars(select(Portfolio).where(Portfolio.user_id == user.id).order_by(Portfolio.name)))


def create_portfolio(db: Session, user: User, name: str, currency: str) -> Portfolio:
    portfolio = Portfolio(user_id=user.id, name=name, currency=currency.upper())
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)
    return portfolio


def get_owned_portfolio(db: Session, user: User, portfolio_id: uuid.UUID) -> Portfolio:
    portfolio = db.get(Portfolio, portfolio_id)
    if portfolio is None or portfolio.user_id != user.id:
        raise PortfolioNotFoundError(str(portfolio_id))
    return portfolio


def rename_portfolio(db: Session, portfolio: Portfolio, name: str) -> Portfolio:
    portfolio.name = name
    db.commit()
    db.refresh(portfolio)
    return portfolio


def delete_portfolio(db: Session, portfolio: Portfolio) -> None:
    db.delete(portfolio)
    db.commit()


def add_transaction(
    db: Session,
    provider: Provider,
    portfolio: Portfolio,
    yahoo_symbol: str,
    tx_type: str,
    trade_date: date,
    quantity: float,
    price: float,
    lot_strategy: str = "fifo",
    lots: dict[uuid.UUID, float] | None = None,
) -> Transaction:
    asset = get_or_create_asset(db, provider, yahoo_symbol)
    if asset.currency != portfolio.currency:
        raise ValueError(
            f"{asset.yahoo_symbol} cotiza en {asset.currency}, pero este portafolio es {portfolio.currency} "
            "— no se pueden mezclar monedas en un mismo portafolio"
        )
    if latest_price(db, asset.id) is None:
        # First time this asset is bought: do the full ingestion (fundamentals,
        # 5y price history, dividends) instead of just a live quote, so it
        # shows up in the Screener and the performance chart immediately
        # instead of only after a separate manual "Agregar ticker" — that's
        # the one-time cost that makes every later page load fast (reads
        # from Postgres, no live Yahoo calls). Falls back to a plain quote
        # if the fuller fetch fails, so a Yahoo hiccup doesn't block recording
        # the purchase.
        try:
            ingest_full_asset(db, provider, asset.yahoo_symbol)
        except Exception:
            logger.warning("full ingestion failed for new asset %s, falling back to a live quote", asset.yahoo_symbol, exc_info=True)
            refresh_quote(db, provider, asset)

    tx = Transaction(
        portfolio_id=portfolio.id,
        asset_id=asset.id,
        type=TransactionType.BUY if tx_type == "buy" else TransactionType.SELL,
        trade_date=trade_date,
        quantity=quantity,
        price=price,
        gross_amount=quantity * price,
        currency=portfolio.currency,
        fx_rate=1.0,
        remaining_quantity=quantity if tx_type == "buy" else None,
    )
    db.add(tx)
    db.flush()  # need tx.id before allocating lots against it
    if tx_type == "sell":
        try:
            if lot_strategy == "lifo":
                lots_service.allocate_lifo(db, tx)
            elif lot_strategy == "specific":
                lots_service.allocate_specific(db, tx, lots or {})
            else:
                lots_service.allocate_fifo(db, tx)
        except InsufficientQuantityError:
            db.rollback()
            raise
    db.commit()
    db.refresh(tx)
    return tx


def import_transactions(
    db: Session, provider: Provider, user: User, rows: list[TransactionImportRow]
) -> list[TransactionImportRowResult]:
    """Bulk CSV import (mirrors the "Exportar movimientos" template) — each
    row goes through the exact same validation as a manual add_transaction
    (currency match, lot availability on a sell), just looped so one bad
    row's error doesn't block the rest of the batch. Sells always use FIFO
    — the CSV format has no column for picking a specific lot or LIFO.
    """
    portfolios_by_name = {p.name.strip().casefold(): p for p in list_portfolios(db, user)}
    results: list[TransactionImportRowResult] = []
    for i, row in enumerate(rows):
        portfolio = portfolios_by_name.get(row.portfolio_name.strip().casefold())
        if portfolio is None:
            results.append(
                TransactionImportRowResult(row=i, status="error", message=f'Portafolio "{row.portfolio_name}" no existe.')
            )
            continue
        try:
            tx = add_transaction(db, provider, portfolio, row.yahoo_symbol, row.type, row.trade_date, row.quantity, row.price)
            results.append(TransactionImportRowResult(row=i, status="ok", transaction=TransactionOut.model_validate(tx)))
        except (ValueError, InsufficientQuantityError, LotAllocationError) as exc:
            db.rollback()
            results.append(TransactionImportRowResult(row=i, status="error", message=str(exc)))
        except Exception:
            db.rollback()
            logger.warning("import_transactions: unexpected error on row %d", i, exc_info=True)
            results.append(TransactionImportRowResult(row=i, status="error", message="Error inesperado procesando esta fila."))
    return results


def list_open_lots_by_symbol(db: Session, portfolio: Portfolio, yahoo_symbol: str) -> list[Transaction]:
    asset = db.scalar(select(Asset).where(Asset.yahoo_symbol == yahoo_symbol.strip().upper()))
    if asset is None:
        return []
    return lots_service.open_lots(db, portfolio.id, asset.id)


def list_transactions(db: Session, portfolio: Portfolio) -> list[Transaction]:
    return list(
        db.scalars(
            select(Transaction)
            .where(Transaction.portfolio_id == portfolio.id)
            .order_by(Transaction.trade_date.desc())
        )
    )


def delete_transaction(db: Session, portfolio: Portfolio, transaction_id: uuid.UUID) -> None:
    tx = db.get(Transaction, transaction_id)
    if tx is None or tx.portfolio_id != portfolio.id:
        return
    if tx.type == TransactionType.SELL:
        lots_service.reverse_allocations(db, tx.id)
    elif tx.type == TransactionType.BUY and lots_service.allocated_quantity(tx) > 1e-6:
        raise LotAllocationError(
            f"no se puede eliminar — {lots_service.allocated_quantity(tx)} acciones de esta compra ya fueron "
            "vendidas; elimina esa venta primero"
        )
    db.delete(tx)
    db.commit()


def update_transaction(
    db: Session, portfolio: Portfolio, transaction_id: uuid.UUID, trade_date: date, quantity: float, price: float
) -> Transaction:
    """Fixes a typo'd date/quantity/price on an existing transaction without
    the delete-and-re-add round trip — the asset and buy/sell type are fixed
    (changing either is really a different transaction, not a correction).

    A SELL's lot allocations are reversed and re-run against the (possibly
    changed) quantity. A BUY can't be shrunk below what's already been sold
    out of it — editing its trade_date doesn't retroactively re-run FIFO for
    sells that already consumed it, same as a real brokerage statement.
    """
    tx = db.get(Transaction, transaction_id)
    if tx is None or tx.portfolio_id != portfolio.id:
        raise TransactionNotFoundError(str(transaction_id))

    if tx.type == TransactionType.SELL:
        lots_service.reverse_allocations(db, tx.id)
        db.flush()
        tx.trade_date = trade_date
        tx.quantity = quantity
        tx.price = price
        tx.gross_amount = quantity * price
        db.flush()
        try:
            lots_service.allocate_fifo(db, tx)
        except InsufficientQuantityError:
            db.rollback()
            raise
    else:
        allocated = lots_service.allocated_quantity(tx)
        if quantity < allocated - 1e-6:
            raise LotAllocationError(
                f"no se puede reducir a {quantity} — ya se vendieron {allocated} acciones de este lote"
            )
        tx.trade_date = trade_date
        tx.remaining_quantity = quantity - allocated
        tx.quantity = quantity
        tx.price = price
        tx.gross_amount = quantity * price

    db.commit()
    db.refresh(tx)
    return tx


def delete_position(db: Session, portfolio: Portfolio, asset_id: uuid.UUID) -> None:
    db.query(Transaction).filter(
        Transaction.portfolio_id == portfolio.id, Transaction.asset_id == asset_id
    ).delete()
    db.query(HoldingTag).filter(
        HoldingTag.portfolio_id == portfolio.id, HoldingTag.asset_id == asset_id
    ).delete()
    db.commit()


def set_holding_tags(db: Session, user: User, portfolio: Portfolio, asset_id: uuid.UUID, labels: list[str]) -> list[str]:
    db.query(HoldingTag).filter(
        HoldingTag.portfolio_id == portfolio.id, HoldingTag.asset_id == asset_id
    ).delete()
    for label in labels:
        tag = db.scalar(select(Tag).where(Tag.user_id == user.id, Tag.label == label))
        if tag is None:
            tag = Tag(user_id=user.id, label=label)
            db.add(tag)
            db.flush()
        db.add(HoldingTag(portfolio_id=portfolio.id, asset_id=asset_id, tag_id=tag.id))
    db.commit()
    return labels


@dataclass
class _AssetLot:
    asset: Asset
    quantity: float = 0.0
    cost_total: float = 0.0


@dataclass
class _LedgerResult:
    holdings: dict[uuid.UUID, _AssetLot] = field(default_factory=dict)
    compras_totales: float = 0.0
    gp_realizada: float = 0.0


def run_ledger(db: Session, portfolio_id: uuid.UUID) -> _LedgerResult:
    """Holdings/cost-basis from open lot quantities, and realized P&L from
    actual lot allocations — not a blended running average. A BUY's
    remaining_quantity (updated by lots.allocate_*/reverse_allocations on
    every sell/edit/delete) is always the current source of truth for what's
    still held; TransactionLotAllocation is the source of truth for what was
    sold against what, at what cost.
    """
    txs = list(
        db.scalars(
            select(Transaction)
            .where(Transaction.portfolio_id == portfolio_id, Transaction.asset_id.is_not(None))
            .order_by(Transaction.trade_date)
        )
    )
    by_asset: dict[uuid.UUID, list[Transaction]] = {}
    for t in txs:
        by_asset.setdefault(t.asset_id, []).append(t)

    result = _LedgerResult()
    for asset_id, asset_txs in by_asset.items():
        qty = 0.0
        cost_total = 0.0
        for t in asset_txs:
            if t.type != TransactionType.BUY:
                continue
            qty += float(t.remaining_quantity or 0)
            cost_total += float(t.remaining_quantity or 0) * float(t.price)
            result.compras_totales += float(t.gross_amount)
        if qty > 1e-6:
            asset = db.get(Asset, asset_id)
            result.holdings[asset_id] = _AssetLot(asset=asset, quantity=qty, cost_total=cost_total)

    BuyTx = aliased(Transaction)
    SellTx = aliased(Transaction)
    gp_rows = db.execute(
        select(SellTx.price, BuyTx.price, TransactionLotAllocation.quantity)
        .join(SellTx, TransactionLotAllocation.sell_transaction_id == SellTx.id)
        .join(BuyTx, TransactionLotAllocation.buy_transaction_id == BuyTx.id)
        .where(SellTx.portfolio_id == portfolio_id)
    ).all()
    for sell_price, buy_price, alloc_qty in gp_rows:
        result.gp_realizada += (float(sell_price) - float(buy_price)) * float(alloc_qty)

    return result


@dataclass
class DividendPayment:
    asset_id: uuid.UUID
    event: DividendEvent
    quantity: float  # actual shares held at the event's ex_date, not today's holding


def dividend_payments(db: Session, portfolio_id: uuid.UUID, through: date | None = None) -> list[DividendPayment]:
    """Every dividend event actually paid to this portfolio, using the real
    share count held on each ex-dividend date (reconstructed from
    transaction history) instead of the current holding — so a position
    bought *after* an ex-date is correctly excluded from that payment (you
    weren't a shareholder yet), a position sold in full still counts for
    dividends paid while it was held, and a fully-zero holding at some
    ex-date is skipped rather than backdating today's quantity onto it.
    Shared by the "dividendos cobrados" KPI and the Movimientos "abonos"
    feed — both need the same real history, not two different guesses.
    """
    through = through or date.today()
    txs = list(
        db.scalars(
            select(Transaction)
            .where(Transaction.portfolio_id == portfolio_id, Transaction.asset_id.is_not(None))
            .order_by(Transaction.trade_date)
        )
    )
    by_asset: dict[uuid.UUID, list[Transaction]] = {}
    for t in txs:
        by_asset.setdefault(t.asset_id, []).append(t)

    payments: list[DividendPayment] = []
    for asset_id, asset_txs in by_asset.items():
        events = list(
            db.scalars(
                select(DividendEvent)
                .where(DividendEvent.asset_id == asset_id, DividendEvent.ex_date <= through)
                .order_by(DividendEvent.ex_date)
            )
        )
        if not events:
            continue
        qty = 0.0
        tx_idx = 0
        for event in events:
            while tx_idx < len(asset_txs) and asset_txs[tx_idx].trade_date <= event.ex_date:
                t = asset_txs[tx_idx]
                if t.type == TransactionType.BUY:
                    qty += float(t.quantity or 0)
                else:
                    qty = max(0.0, qty - float(t.quantity or 0))
                tx_idx += 1
            if qty <= 1e-9:
                continue
            payments.append(DividendPayment(asset_id=asset_id, event=event, quantity=qty))
    return payments


def _dividends_collected(db: Session, user: User, portfolio_id: uuid.UUID) -> tuple[float, float]:
    """Total dividends actually paid to date — see dividend_payments()."""
    by_asset_country: dict[uuid.UUID, float] = {}
    total_bruto = 0.0
    total_neto = 0.0
    for payment in dividend_payments(db, portfolio_id):
        withholding = by_asset_country.get(payment.asset_id)
        if withholding is None:
            asset = db.get(Asset, payment.asset_id)
            withholding = withholding_for_country(db, user, asset.country)
            by_asset_country[payment.asset_id] = withholding
        gross = payment.quantity * float(payment.event.amount_per_share)
        total_bruto += gross
        total_neto += gross * (1 - withholding)
    return total_bruto, total_neto


def compute_summary(db: Session, user: User, portfolio: Portfolio) -> PortfolioSummaryOut:
    ledger = run_ledger(db, portfolio.id)
    dividendos_cobrados_bruto, dividendos_cobrados_neto = _dividends_collected(db, user, portfolio.id)

    holdings_out: list[HoldingOut] = []
    valor_total = 0.0
    costo_total = 0.0
    dividendo_anual_bruto = 0.0
    dividendo_anual_neto = 0.0

    for asset_id, lot in ledger.holdings.items():
        price_row = latest_price(db, asset_id)
        avg_cost = lot.cost_total / lot.quantity if lot.quantity else 0.0
        price = float(price_row.close) if price_row is not None else avg_cost
        is_stale = bool(price_row.is_stale) if price_row is not None else False

        fundamentals = db.scalar(
            select(Fundamentals).where(Fundamentals.asset_id == asset_id).order_by(Fundamentals.as_of.desc())
        )
        # Fundamentals.dividend_yield is stored as a percentage number (5.3
        # meaning 5.3%), matching the screener/comparador display — divide
        # by 100 here since this is the one place it feeds an arithmetic
        # calculation instead of just being formatted for display.
        div_yield_pct = float(fundamentals.dividend_yield) if fundamentals and fundamentals.dividend_yield else 0.0
        dividend_per_share = price * (div_yield_pct / 100)

        tags = list(
            db.scalars(
                select(Tag.label)
                .join(HoldingTag, HoldingTag.tag_id == Tag.id)
                .where(HoldingTag.portfolio_id == portfolio.id, HoldingTag.asset_id == asset_id)
            )
        )

        market_value = lot.quantity * price
        unrealized_pl = market_value - lot.cost_total
        valor_total += market_value
        costo_total += lot.cost_total
        withholding = withholding_for_country(db, user, lot.asset.country)
        dividendo_anual_bruto += lot.quantity * dividend_per_share
        dividendo_anual_neto += lot.quantity * dividend_per_share * (1 - withholding)

        holdings_out.append(
            HoldingOut(
                asset=lot.asset,
                tags=tags,
                quantity=lot.quantity,
                avg_cost=avg_cost,
                price=price,
                price_is_stale=is_stale,
                market_value=market_value,
                cost_basis=lot.cost_total,
                unrealized_pl=unrealized_pl,
                yield_on_cost=(dividend_per_share * lot.quantity / lot.cost_total) if lot.cost_total > 0 else 0.0,
                dividend_per_share_ttm=dividend_per_share,
            )
        )

    holdings_out.sort(key=lambda h: h.asset.yahoo_symbol)

    return PortfolioSummaryOut(
        portfolio=portfolio,
        holdings=holdings_out,
        valor_total=valor_total,
        costo_total=costo_total,
        aportes=ledger.compras_totales,
        compras_totales=ledger.compras_totales,
        gp_realizada=ledger.gp_realizada,
        gp_no_realizada=valor_total - costo_total,
        dividendo_anual_bruto=dividendo_anual_bruto,
        dividendo_anual_neto=dividendo_anual_neto,
        dividendos_cobrados_bruto=dividendos_cobrados_bruto,
        dividendos_cobrados_neto=dividendos_cobrados_neto,
    )


def compute_country_allocation(db: Session, user: User, display_currency: str) -> CountryAllocationOut:
    """Market value of every holding across all of the user's portfolios,
    grouped by asset country and converted to a single display currency —
    powers the world map on the perfil page.
    """
    rates = fx_service.get_rates(db)
    totals: dict[str, float] = {}

    for portfolio in list_portfolios(db, user):
        summary = compute_summary(db, user, portfolio)
        for holding in summary.holdings:
            converted = fx_service.convert(holding.market_value, portfolio.currency, display_currency, rates)
            totals[holding.asset.country] = totals.get(holding.asset.country, 0.0) + converted

    rows = [CountryAllocationRow(country=country, value=value) for country, value in totals.items()]
    rows.sort(key=lambda r: r.value, reverse=True)
    return CountryAllocationOut(currency=display_currency, rows=rows)


def _add_months(d: date, months: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    day = min(d.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _monthly_sample_dates(start: date, end: date) -> list[date]:
    """Roughly one point per month from `start` to `end` inclusive, always
    anchored on `start` and `end` exactly (so the chart's first point is
    truly the earliest purchase date and the last is always "today")."""
    dates = [start]
    cursor = start
    while True:
        cursor = _add_months(cursor, 1)
        if cursor >= end:
            break
        dates.append(cursor)
    if dates[-1] != end:
        dates.append(end)
    return dates


def _daily_sample_dates(start: date, end: date) -> list[date]:
    """One point per calendar day — used for the short ranges (1D/1W/1M/3M)
    where monthly buckets would collapse to almost nothing."""
    dates = []
    cursor = start
    while cursor < end:
        dates.append(cursor)
        cursor += timedelta(days=1)
    dates.append(end)
    return dates


def sample_dates_for_range(range_key: str, earliest: date, today: date) -> tuple[date, list[date]]:
    """Resolves a UI range key ("1D".."5A") to (start_date, sample_dates),
    clamped to `earliest` — shared between get_portfolio_performance and
    the networth-history endpoint so the two never silently diverge on what
    a given range means.
    """
    if range_key in _PERFORMANCE_RANGE_DAYS:
        range_start = today - timedelta(days=_PERFORMANCE_RANGE_DAYS[range_key])
        start = max(earliest, range_start)
        return start, _daily_sample_dates(start, today)
    years = _PERFORMANCE_RANGE_YEARS.get(range_key, 3)
    range_start = _add_months(today, -12 * years)
    start = max(earliest, range_start)
    return start, _monthly_sample_dates(start, today)


def portfolio_values_at_dates(db: Session, portfolio_id: uuid.UUID, sample_dates: list[date]) -> dict[date, float]:
    """Portfolio market value (native currency) at each of `sample_dates`,
    replaying BUY/SELL quantity changes chronologically and pricing each
    held asset at-or-before that date. Shared by get_portfolio_performance
    (single portfolio, own currency, plus a benchmark series) and
    networth.compute_history (every portfolio, converted to one display
    currency) — "what did I hold on date X, and what was it worth" belongs
    in exactly one place.
    """
    txs = list(
        db.scalars(
            select(Transaction)
            .where(Transaction.portfolio_id == portfolio_id, Transaction.asset_id.is_not(None))
            .order_by(Transaction.trade_date)
        )
    )
    asset_ids = {t.asset_id for t in txs}

    # Anchor each asset's price series with its own transaction prices, not
    # just the ingested Price table — guarantees a real value exists on the
    # exact date of a purchase even for a ticker that was only ever added
    # through a plain "buy" (get_or_create_asset + a single live quote), not
    # the full 5y-history ingestion the Screener's "add ticker" path does.
    prices_by_asset: dict[uuid.UUID, tuple[list[date], list[float]]] = {}
    for asset_id in asset_ids:
        rows = db.execute(
            select(Price.date, Price.close).where(Price.asset_id == asset_id).order_by(Price.date)
        ).all()
        merged: dict[date, float] = {row.date: float(row.close) for row in rows}
        for t in txs:
            if t.asset_id == asset_id:
                merged.setdefault(t.trade_date, float(t.price))
        ordered = sorted(merged.items())
        prices_by_asset[asset_id] = ([d for d, _ in ordered], [p for _, p in ordered])

    def price_at_or_before(asset_id: uuid.UUID, on: date) -> float | None:
        dates, closes = prices_by_asset.get(asset_id, ([], []))
        idx = bisect_right(dates, on) - 1
        return closes[idx] if idx >= 0 else None

    values: dict[date, float] = {}
    qty_by_asset: dict[uuid.UUID, float] = {}
    tx_idx = 0
    for d in sample_dates:
        while tx_idx < len(txs) and txs[tx_idx].trade_date <= d:
            t = txs[tx_idx]
            if t.type == TransactionType.BUY:
                qty_by_asset[t.asset_id] = qty_by_asset.get(t.asset_id, 0.0) + float(t.quantity or 0)
            else:
                qty_by_asset[t.asset_id] = max(0.0, qty_by_asset.get(t.asset_id, 0.0) - float(t.quantity or 0))
            tx_idx += 1

        value = 0.0
        for asset_id, qty in qty_by_asset.items():
            if qty <= 1e-9:
                continue
            price = price_at_or_before(asset_id, d)
            if price is not None:
                value += qty * price
        values[d] = value

    return values


def get_portfolio_performance(
    db: Session, provider: Provider, portfolio: Portfolio, range_key: str
) -> PortfolioPerformanceOut:
    """Real portfolio market value over time, alongside the S&P 500 for
    comparison — both independently rebased to 100 by the frontend, so
    absolute currency/units don't need to match.

    The series always starts at the portfolio's earliest transaction date,
    clamped to the requested range (1D/1W/1M/3M/1A/3A/5A) — never further
    back than that range, but never fabricating history that predates the
    first purchase either, even if a longer range was requested.
    """
    today = date.today()
    earliest = db.scalar(
        select(func.min(Transaction.trade_date)).where(Transaction.portfolio_id == portfolio.id)
    )
    if earliest is None:
        return PortfolioPerformanceOut(start_date=today, currency=portfolio.currency, points=[])

    start, sample_dates = sample_dates_for_range(range_key, earliest, today)
    if range_key in _PERFORMANCE_RANGE_DAYS:
        benchmark_period = _BENCHMARK_PERIOD_FOR_SHORT_RANGE[range_key]
    else:
        benchmark_period = f"{_PERFORMANCE_RANGE_YEARS.get(range_key, 3)}y"

    values = portfolio_values_at_dates(db, portfolio.id, sample_dates)

    benchmark_dates: list[date] = []
    benchmark_closes: list[float] = []
    try:
        # Same benchmark history gets re-fetched from Yahoo on every
        # performance-chart view regardless of which portfolio/user is
        # looking — cached per (symbol, period) for a few hours so only the
        # first view of the day pays for the live fetch.
        cache_key = f"benchmark-history:{_BENCHMARK_SYMBOL}:{benchmark_period}"
        cached = cache_get_json(cache_key)
        if cached is not None:
            history = [QuoteResult(symbol=_BENCHMARK_SYMBOL, date=date.fromisoformat(d), close=c) for d, c in cached]
        else:
            history = provider.get_history(_BENCHMARK_SYMBOL, period=benchmark_period)
            cache_set_json(cache_key, [[q.date.isoformat(), q.close] for q in history], ttl_seconds=6 * 3600)
        ordered_history = sorted(history, key=lambda q: q.date)
        benchmark_dates = [q.date for q in ordered_history]
        benchmark_closes = [q.close for q in ordered_history]
    except Exception:
        logger.warning("could not fetch %s benchmark history", _BENCHMARK_SYMBOL, exc_info=True)

    def benchmark_at_or_before(on: date) -> float | None:
        idx = bisect_right(benchmark_dates, on) - 1
        return benchmark_closes[idx] if idx >= 0 else None

    points = [
        PerformancePointOut(date=d, cartera_value=values[d], benchmark_index=benchmark_at_or_before(d))
        for d in sample_dates
    ]
    return PortfolioPerformanceOut(start_date=start, currency=portfolio.currency, points=points)
