from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.user import User
from app.modules.dividends.service import list_paid_dividends
from app.modules.portfolios.service import list_portfolios, list_transactions
from app.schemas.movements import MovementOut


def list_movements(db: Session, user: User) -> list[MovementOut]:
    """Unified buy/sell/dividend ledger across every portfolio the user
    owns — powers the exportable movements table (compras, ventas, abonos).
    """
    movements: list[MovementOut] = []
    for portfolio in list_portfolios(db, user):
        for tx in list_transactions(db, portfolio):
            if tx.asset is None:
                continue
            movements.append(
                MovementOut(
                    date=tx.trade_date,
                    kind=tx.type.value,
                    portfolio_id=portfolio.id,
                    portfolio_name=portfolio.name,
                    yahoo_symbol=tx.asset.yahoo_symbol,
                    asset_name=tx.asset.name,
                    quantity=float(tx.quantity or 0),
                    price=float(tx.price or 0),
                    total=float(tx.gross_amount),
                    currency=tx.currency,
                )
            )
        for div in list_paid_dividends(db, user, portfolio):
            movements.append(
                MovementOut(
                    date=div.ex_date,
                    kind="dividend",
                    portfolio_id=portfolio.id,
                    portfolio_name=portfolio.name,
                    yahoo_symbol=div.yahoo_symbol,
                    asset_name=div.name,
                    quantity=div.quantity,
                    price=div.amount_per_share,
                    total=div.total_bruto,
                    currency=portfolio.currency,
                )
            )

    movements.sort(key=lambda m: m.date, reverse=True)
    return movements
