"""alerts: price watches, in-app only

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-18
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    alert_condition = postgresql.ENUM("price_below", "price_above", name="alert_condition")
    op.create_table(
        "alerts",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("asset_id", sa.Uuid(), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False),
        sa.Column("condition", alert_condition, nullable=False),
        sa.Column("threshold", sa.Numeric(18, 6), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("triggered_at", sa.Date(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_alerts_user_id", "alerts", ["user_id"])
    op.create_index("ix_alerts_asset_id", "alerts", ["asset_id"])


def downgrade() -> None:
    op.drop_table("alerts")
    op.execute("DROP TYPE IF EXISTS alert_condition")
