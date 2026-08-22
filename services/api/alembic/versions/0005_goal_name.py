"""goals: name column for custom net_worth goals

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-21
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("goals", sa.Column("name", sa.String(120), nullable=True))


def downgrade() -> None:
    op.drop_column("goals", "name")
