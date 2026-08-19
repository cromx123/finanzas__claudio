from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.portfolio import Asset, Transaction, TransactionLotAllocation, TransactionType


class InsufficientQuantityError(Exception):
    pass


class LotAllocationError(Exception):
    """A BUY can't be edited/deleted because a SELL already depends on it."""

    pass


def open_lots(db: Session, portfolio_id: uuid.UUID, asset_id: uuid.UUID) -> list[Transaction]:
    """BUY transactions for this asset that still have unconsumed quantity,
    oldest first (FIFO order) — LIFO/specific-lot selection just pick a
    different subset/order from this same list.
    """
    return list(
        db.scalars(
            select(Transaction)
            .where(
                Transaction.portfolio_id == portfolio_id,
                Transaction.asset_id == asset_id,
                Transaction.type == TransactionType.BUY,
                Transaction.remaining_quantity > 1e-9,
            )
            .order_by(Transaction.trade_date, Transaction.id)
        )
    )


def allocate_fifo(db: Session, sell_tx: Transaction) -> None:
    """Consumes open lots oldest-first for `sell_tx.quantity`, creating
    TransactionLotAllocation rows and decrementing each consumed lot's
    remaining_quantity. Raises InsufficientQuantityError if the asset's open
    lots don't cover the requested quantity.
    """
    lots = open_lots(db, sell_tx.portfolio_id, sell_tx.asset_id)
    _allocate(db, sell_tx, lots)


def allocate_lifo(db: Session, sell_tx: Transaction) -> None:
    """Same as allocate_fifo but consumes the newest lots first."""
    lots = list(reversed(open_lots(db, sell_tx.portfolio_id, sell_tx.asset_id)))
    _allocate(db, sell_tx, lots)


def allocate_specific(db: Session, sell_tx: Transaction, lot_quantities: dict[uuid.UUID, float]) -> None:
    """Consumes exactly the caller-chosen lots/quantities. Every referenced
    lot must belong to this asset/portfolio and have enough remaining
    quantity; the total must match `sell_tx.quantity` exactly (no implicit
    top-up from other lots — that's what FIFO/LIFO are for).
    """
    available = {lot.id: lot for lot in open_lots(db, sell_tx.portfolio_id, sell_tx.asset_id)}
    requested_total = sum(lot_quantities.values())
    if abs(requested_total - float(sell_tx.quantity)) > 1e-6:
        raise InsufficientQuantityError(
            f"la suma de los lotes elegidos ({requested_total}) no coincide con la cantidad a vender ({sell_tx.quantity})"
        )
    for lot_id, qty in lot_quantities.items():
        lot = available.get(lot_id)
        if lot is None:
            raise InsufficientQuantityError(f"lote {lot_id} no disponible para este activo")
        if qty > float(lot.remaining_quantity) + 1e-6:
            raise InsufficientQuantityError(
                f"el lote del {lot.trade_date} solo tiene {lot.remaining_quantity} acciones disponibles"
            )
        if qty <= 0:
            raise InsufficientQuantityError("la cantidad por lote debe ser mayor a 0")

    for lot_id, qty in lot_quantities.items():
        lot = available[lot_id]
        _consume(db, sell_tx, lot, qty)


def _allocate(db: Session, sell_tx: Transaction, lots: list[Transaction]) -> None:
    total_open = sum(float(lot.remaining_quantity) for lot in lots)
    if float(sell_tx.quantity) > total_open + 1e-6:
        asset = db.get(Asset, sell_tx.asset_id)
        raise InsufficientQuantityError(f"only {total_open} shares of {asset.yahoo_symbol} available")

    remaining_to_sell = float(sell_tx.quantity)
    for lot in lots:
        if remaining_to_sell <= 1e-9:
            break
        take = min(float(lot.remaining_quantity), remaining_to_sell)
        _consume(db, sell_tx, lot, take)
        remaining_to_sell -= take


def _consume(db: Session, sell_tx: Transaction, lot: Transaction, quantity: float) -> None:
    lot.remaining_quantity = float(lot.remaining_quantity) - quantity
    db.add(
        TransactionLotAllocation(
            sell_transaction_id=sell_tx.id,
            buy_transaction_id=lot.id,
            quantity=quantity,
            cost_basis=quantity * float(lot.price),
        )
    )


def reverse_allocations(db: Session, sell_transaction_id: uuid.UUID) -> None:
    """Restores remaining_quantity to whatever lots a sell consumed, and
    removes the allocation rows — used before re-allocating an edited sell,
    and before deleting one.
    """
    allocations = list(
        db.scalars(
            select(TransactionLotAllocation).where(TransactionLotAllocation.sell_transaction_id == sell_transaction_id)
        )
    )
    for alloc in allocations:
        buy = db.get(Transaction, alloc.buy_transaction_id)
        buy.remaining_quantity = float(buy.remaining_quantity) + float(alloc.quantity)
        db.delete(alloc)


def allocated_quantity(tx: Transaction) -> float:
    """How much of a BUY lot has already been consumed by sells — used to
    guard edits/deletes against shrinking a lot below what's been sold."""
    return float(tx.quantity) - float(tx.remaining_quantity or 0)
