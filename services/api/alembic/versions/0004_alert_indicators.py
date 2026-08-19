"""alerts: open-ended indicator conditions (RSI, Bollinger, ...)

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-19
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # `condition` moves from a fixed Postgres enum to a plain string,
    # validated against the indicators.INDICATORS registry in code instead —
    # a new indicator is then a code change, not an `ALTER TYPE ... ADD
    # VALUE` migration every time.
    op.alter_column(
        "alerts",
        "condition",
        type_=sa.String(40),
        existing_type=postgresql.ENUM(name="alert_condition"),
        postgresql_using="condition::text",
    )
    op.execute("DROP TYPE IF EXISTS alert_condition")

    # Not every indicator needs a threshold (a Bollinger-band-cross alert
    # doesn't) — and indicator-specific config (RSI's period, Bollinger's
    # period/stddev) lands in the new `params` column.
    op.alter_column("alerts", "threshold", existing_type=sa.Numeric(18, 6), nullable=True)
    op.add_column("alerts", sa.Column("params", sa.JSON(), nullable=False, server_default="{}"))


def downgrade() -> None:
    op.drop_column("alerts", "params")
    op.execute("UPDATE alerts SET threshold = 0 WHERE threshold IS NULL")
    op.alter_column("alerts", "threshold", existing_type=sa.Numeric(18, 6), nullable=False)

    alert_condition = postgresql.ENUM("price_below", "price_above", name="alert_condition")
    alert_condition.create(op.get_bind(), checkfirst=True)
    op.alter_column(
        "alerts",
        "condition",
        type_=alert_condition,
        existing_type=sa.String(40),
        postgresql_using="condition::alert_condition",
    )
