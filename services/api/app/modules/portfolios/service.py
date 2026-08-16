from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.market import Fundamentals, Price
from app.models.portfolio import Asset, Portfolio, Transaction, TransactionType
from app.models.strategy import HoldingTag, Tag
from app.models.user import User, UserTaxRule
from app.modules.assets.service import get_or_create_asset, latest_price, refresh_quote
from app.modules.ingestion.providers.base import Provider
from app.schemas.portfolios import HoldingOut, PortfolioSummaryOut


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


def current_quantity(db: Session, portfolio_id: uuid.UUID, asset_id: uuid.UUID) -> float:
    rows = db.scalars(
        select(Transaction)
        .where(Transaction.portfolio_id == portfolio_id, Transaction.asset_id == asset_id)
        .order_by(Transaction.trade_date)
    )
    qty = 0.0
    for t in rows:
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
    if latest_price(db, asset.id) is None:
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


def compute_summary(db: Session, user: User, portfolio: Portfolio) -> PortfolioSummaryOut:
    ledger = run_ledger(db, portfolio.id)

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
    )
