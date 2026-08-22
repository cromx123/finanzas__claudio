"""tags: target_weight column for the rebalancing helper

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tags", sa.Column("target_weight", sa.Numeric(5, 2), nullable=True))


def downgrade() -> None:
    op.drop_column("tags", "target_weight")
