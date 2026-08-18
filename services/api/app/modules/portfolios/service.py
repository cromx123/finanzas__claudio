from __future__ import annotations

import calendar
import logging
import uuid
from bisect import bisect_right
from dataclasses import dataclass, field
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.market import DividendEvent, Fundamentals, Price
from app.models.portfolio import Asset, Portfolio, Transaction, TransactionType
from app.models.strategy import HoldingTag, Tag
from app.models.user import User, UserTaxRule
from app.modules.assets.service import get_or_create_asset, ingest_full_asset, latest_price, refresh_quote
from app.modules.fx import service as fx_service
from app.modules.ingestion.providers.base import Provider
from app.schemas.portfolios import (
    CountryAllocationOut,
    CountryAllocationRow,
    HoldingOut,
    PerformancePointOut,
    PortfolioPerformanceOut,
    PortfolioSummaryOut,
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


class InsufficientQuantityError(Exception):
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


def current_quantity(
    db: Session, portfolio_id: uuid.UUID, asset_id: uuid.UUID, exclude_transaction_id: uuid.UUID | None = None
) -> float:
    rows = db.scalars(
        select(Transaction)
        .where(Transaction.portfolio_id == portfolio_id, Transaction.asset_id == asset_id)
        .order_by(Transaction.trade_date)
    )
    qty = 0.0
    for t in rows:
        if exclude_transaction_id is not None and t.id == exclude_transaction_id:
            continue
        if t.type == TransactionType.BUY:
            qty += float(t.quantity or 0)
        elif t.type == TransactionType.SELL:
            qty = max(0.0, qty - float(t.quantity or 0))
    return qty


def add_transaction(
    db: Session,
    provider: Provider,
    portfolio: Portfolio,
    yahoo_symbol: str,
    tx_type: str,
    trade_date: date,
    quantity: float,
    price: float,
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

    if tx_type == "sell":
        owned = current_quantity(db, portfolio.id, asset.id)
        if quantity > owned + 1e-6:
            raise InsufficientQuantityError(f"only {owned} shares of {asset.yahoo_symbol} available")

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
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return tx


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
    db.delete(tx)
    db.commit()


def update_transaction(
    db: Session, portfolio: Portfolio, transaction_id: uuid.UUID, trade_date: date, quantity: float, price: float
) -> Transaction:
    """Fixes a typo'd date/quantity/price on an existing transaction without
    the delete-and-re-add round trip — the asset and buy/sell type are fixed
    (changing either is really a different transaction, not a correction).
    """
    tx = db.get(Transaction, transaction_id)
    if tx is None or tx.portfolio_id != portfolio.id:
        raise TransactionNotFoundError(str(transaction_id))

    if tx.type == TransactionType.SELL:
        owned = current_quantity(db, portfolio.id, tx.asset_id, exclude_transaction_id=tx.id)
        if quantity > owned + 1e-6:
            raise InsufficientQuantityError(f"only {owned} shares of {tx.asset.yahoo_symbol} available")

    tx.trade_date = trade_date
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
            if t.type == TransactionType.BUY:
                qty += float(t.quantity or 0)
                cost_total += float(t.gross_amount)
                result.compras_totales += float(t.gross_amount)
            elif t.type == TransactionType.SELL:
                sold = min(float(t.quantity or 0), qty)
                avg_cost = cost_total / qty if qty > 0 else 0
                cost_sold = avg_cost * sold
                result.gp_realizada += float(t.gross_amount) - cost_sold
                qty = max(0.0, qty - sold)
                cost_total = max(0.0, cost_total - cost_sold)
        if qty > 1e-6:
            asset = db.get(Asset, asset_id)
            result.holdings[asset_id] = _AssetLot(asset=asset, quantity=qty, cost_total=cost_total)
    return result


def _dividends_collected(db: Session, user: User, portfolio_id: uuid.UUID) -> tuple[float, float]:
    """Total dividends actually paid to date, using the real share count
    held on each ex-dividend date (reconstructed from transaction history)
    instead of the current holding — so a position that was sold in full
    still counts, and a recently bought one isn't credited with dividends
    paid before it was owned.
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

    today = date.today()
    total_bruto = 0.0
    total_neto = 0.0
    for asset_id, asset_txs in by_asset.items():
        events = list(
            db.scalars(
                select(DividendEvent)
                .where(DividendEvent.asset_id == asset_id, DividendEvent.ex_date <= today)
                .order_by(DividendEvent.ex_date)
            )
        )
        if not events:
            continue
        withholding = withholding_for_country(db, user, asset_txs[0].asset.country)
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
            gross = qty * float(event.amount_per_share)
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

    if range_key in _PERFORMANCE_RANGE_DAYS:
        range_start = today - timedelta(days=_PERFORMANCE_RANGE_DAYS[range_key])
        start = max(earliest, range_start)
        sample_dates = _daily_sample_dates(start, today)
        benchmark_period = _BENCHMARK_PERIOD_FOR_SHORT_RANGE[range_key]
    else:
        years = _PERFORMANCE_RANGE_YEARS.get(range_key, 3)
        range_start = _add_months(today, -12 * years)
        start = max(earliest, range_start)
        sample_dates = _monthly_sample_dates(start, today)
        benchmark_period = f"{years}y"

    txs = list(
        db.scalars(
            select(Transaction)
            .where(Transaction.portfolio_id == portfolio.id, Transaction.asset_id.is_not(None))
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

    benchmark_dates: list[date] = []
    benchmark_closes: list[float] = []
    try:
        history = provider.get_history(_BENCHMARK_SYMBOL, period=benchmark_period)
        ordered_history = sorted(history, key=lambda q: q.date)
        benchmark_dates = [q.date for q in ordered_history]
        benchmark_closes = [q.close for q in ordered_history]
    except Exception:
        logger.warning("could not fetch %s benchmark history", _BENCHMARK_SYMBOL, exc_info=True)

    def benchmark_at_or_before(on: date) -> float | None:
        idx = bisect_right(benchmark_dates, on) - 1
        return benchmark_closes[idx] if idx >= 0 else None

    points: list[PerformancePointOut] = []
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

        points.append(PerformancePointOut(date=d, cartera_value=value, benchmark_index=benchmark_at_or_before(d)))

    return PortfolioPerformanceOut(start_date=start, currency=portfolio.currency, points=points)
