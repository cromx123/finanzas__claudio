"""tax lots: remaining_quantity + transaction_lot_allocations

Revision ID: 0003
Revises: 0002
Create Date: 2026-08-19
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("transactions", sa.Column("remaining_quantity", sa.Numeric(18, 6), nullable=True))

    op.create_table(
        "transaction_lot_allocations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "sell_transaction_id", sa.Uuid(), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column(
            "buy_transaction_id", sa.Uuid(), sa.ForeignKey("transactions.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("quantity", sa.Numeric(18, 6), nullable=False),
        sa.Column("cost_basis", sa.Numeric(18, 6), nullable=False),
    )
    op.create_index("ix_tla_sell_transaction_id", "transaction_lot_allocations", ["sell_transaction_id"])
    op.create_index("ix_tla_buy_transaction_id", "transaction_lot_allocations", ["buy_transaction_id"])

    _backfill_fifo_lots(op.get_bind())


def _backfill_fifo_lots(bind) -> None:
    """One-time FIFO reconstruction for transactions that predate lot
    tracking — consumes each (portfolio, asset)'s BUYs chronologically
    against its SELLs, so existing accounts get a consistent starting
    remaining_quantity and lot-allocation history instead of NULLs.
    """
    bind.execute(sa.text("UPDATE transactions SET remaining_quantity = quantity WHERE type = 'buy'"))

    rows = bind.execute(
        sa.text(
            "SELECT id, portfolio_id, asset_id, type, trade_date, quantity, price "
            "FROM transactions WHERE asset_id IS NOT NULL ORDER BY portfolio_id, asset_id, trade_date"
        )
    ).fetchall()
    price_by_id = {row.id: float(row.price) for row in rows}

    open_lots: dict[tuple, list[list]] = {}
    for row in rows:
        key = (row.portfolio_id, row.asset_id)
        if row.type == "buy":
            open_lots.setdefault(key, []).append([row.id, float(row.quantity)])
            continue
        if row.type != "sell":
            continue
        to_sell = float(row.quantity)
        for lot in open_lots.get(key, []):
            if to_sell <= 1e-9:
                break
            if lot[1] <= 1e-9:
                continue
            take = min(lot[1], to_sell)
            lot[1] -= take
            to_sell -= take
            bind.execute(
                sa.text(
                    "INSERT INTO transaction_lot_allocations "
                    "(id, sell_transaction_id, buy_transaction_id, quantity, cost_basis) "
                    "VALUES (gen_random_uuid(), :sell_id, :buy_id, :qty, :cost)"
                ),
                {"sell_id": row.id, "buy_id": lot[0], "qty": take, "cost": take * price_by_id[lot[0]]},
            )

    for lots in open_lots.values():
        for lot_id, remaining in lots:
            bind.execute(
                sa.text("UPDATE transactions SET remaining_quantity = :r WHERE id = :id"),
                {"r": remaining, "id": lot_id},
            )


def downgrade() -> None:
    op.drop_table("transaction_lot_allocations")
    op.drop_column("transactions", "remaining_quantity")
