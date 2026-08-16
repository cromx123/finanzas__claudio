"""initial schema: public + market

Revision ID: 0001
Revises:
Create Date: 2026-08-14
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS market")

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("locale", sa.String(10), nullable=False, server_default="es-CL"),
        sa.Column("base_currency", sa.String(3), nullable=False, server_default="CLP"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_tax_rules",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("country_code", sa.String(2), nullable=False),
        sa.Column("broker", sa.String(120), nullable=True),
        sa.Column("withholding_pct", sa.Numeric(5, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
    )

    op.create_table(
        "portfolios",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
    )

    asset_type = postgresql.ENUM(
        "stock", "etf", "reit", "crypto", "index", name="asset_type"
    )
    op.create_table(
        "assets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("yahoo_symbol", sa.String(32), nullable=False),
        sa.Column("exchange_mic", sa.String(10), nullable=False),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("sector", sa.String(120), nullable=True),
        sa.Column("type", asset_type, nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("country", sa.String(2), nullable=False),
    )
    op.create_index("ix_assets_yahoo_symbol", "assets", ["yahoo_symbol"], unique=True)

    transaction_type = postgresql.ENUM(
        "buy", "sell", "dividend", "contribution", "fee", name="transaction_type"
    )
    op.create_table(
        "transactions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "portfolio_id",
            sa.Uuid(),
            sa.ForeignKey("portfolios.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "asset_id", sa.Uuid(), sa.ForeignKey("assets.id", ondelete="RESTRICT"), nullable=True
        ),
        sa.Column("type", transaction_type, nullable=False),
        sa.Column("trade_date", sa.Date(), nullable=False),
        sa.Column("quantity", sa.Numeric(18, 6), nullable=True),
        sa.Column("price", sa.Numeric(18, 6), nullable=True),
        sa.Column("gross_amount", sa.Numeric(18, 6), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("fx_rate", sa.Numeric(18, 8), nullable=False),
        sa.Column("tax_withheld", sa.Numeric(18, 6), nullable=False, server_default="0"),
        sa.Column("is_drip", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index("ix_transactions_portfolio_id", "transactions", ["portfolio_id"])
    op.create_index("ix_transactions_asset_id", "transactions", ["asset_id"])

    op.create_table(
        "tags",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("label", sa.String(60), nullable=False),
        sa.Column("color", sa.String(20), nullable=True),
    )

    op.create_table(
        "holding_tags",
        sa.Column(
            "portfolio_id",
            sa.Uuid(),
            sa.ForeignKey("portfolios.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "asset_id",
            sa.Uuid(),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column(
            "tag_id", sa.Uuid(), sa.ForeignKey("tags.id", ondelete="CASCADE"), primary_key=True
        ),
    )

    goal_kind = postgresql.ENUM(
        "monthly_dividends", "cost_coverage", "net_worth", name="goal_kind"
    )
    op.create_table(
        "goals",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("kind", goal_kind, nullable=False),
        sa.Column("target_amount", sa.Numeric(18, 6), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("monthly_expenses", sa.Numeric(18, 6), nullable=True),
        sa.Column("target_date", sa.Date(), nullable=True),
    )

    op.create_table(
        "prices",
        sa.Column(
            "asset_id",
            sa.Uuid(),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("close", sa.Numeric(18, 6), nullable=False),
        sa.Column("adj_close", sa.Numeric(18, 6), nullable=True),
        sa.Column("volume", sa.BigInteger(), nullable=True),
        sa.Column("is_stale", sa.Boolean(), nullable=False, server_default=sa.false()),
        schema="market",
    )

    op.create_table(
        "fundamentals",
        sa.Column(
            "asset_id",
            sa.Uuid(),
            sa.ForeignKey("assets.id", ondelete="CASCADE"),
            primary_key=True,
        ),
        sa.Column("as_of", sa.Date(), primary_key=True),
        sa.Column("roe", sa.Numeric(10, 4), nullable=True),
        sa.Column("roa", sa.Numeric(10, 4), nullable=True),
        sa.Column("roic", sa.Numeric(10, 4), nullable=True),
        sa.Column("pe_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("payout_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("gross_margin", sa.Numeric(10, 4), nullable=True),
        sa.Column("op_margin", sa.Numeric(10, 4), nullable=True),
        sa.Column("net_margin", sa.Numeric(10, 4), nullable=True),
        sa.Column("dividend_yield", sa.Numeric(10, 4), nullable=True),
        sa.Column("div_cagr_5y", sa.Numeric(10, 4), nullable=True),
        sa.Column("expense_ratio", sa.Numeric(10, 4), nullable=True),
        sa.Column("aum", sa.Numeric(20, 2), nullable=True),
        sa.Column("market_cap", sa.Numeric(20, 2), nullable=True),
        schema="market",
    )

    dividend_status = postgresql.ENUM(
        "declared", "estimated", name="dividend_status", schema="market"
    )
    dividend_frequency = postgresql.ENUM(
        "monthly", "quarterly", "annual", name="dividend_frequency", schema="market"
    )
    op.create_table(
        "dividend_events",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "asset_id", sa.Uuid(), sa.ForeignKey("assets.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("ex_date", sa.Date(), nullable=False),
        sa.Column("pay_date", sa.Date(), nullable=True),
        sa.Column("amount_per_share", sa.Numeric(18, 6), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.Column("status", dividend_status, nullable=False),
        sa.Column("frequency", dividend_frequency, nullable=False),
        schema="market",
    )
    op.create_index(
        "ix_dividend_events_asset_id", "dividend_events", ["asset_id"], schema="market"
    )

    op.create_table(
        "fx_rates",
        sa.Column("base", sa.String(3), primary_key=True),
        sa.Column("quote", sa.String(3), primary_key=True),
        sa.Column("date", sa.Date(), primary_key=True),
        sa.Column("rate", sa.Numeric(18, 8), nullable=False),
        sa.Column("source", sa.String(40), nullable=False),
        schema="market",
    )

    # `holdings` is a read-time rollup of the ledger, never written to directly.
    # realized_pl / yield_on_cost are left as 0 placeholders here — they need
    # sell-lot matching and TTM dividend income, which lands with the ledger
    # + Panel in step 2; this view already gives quantity/cost/market value.
    op.execute(
        """
        CREATE MATERIALIZED VIEW holdings AS
        SELECT
            t.portfolio_id AS portfolio_id,
            t.asset_id AS asset_id,
            SUM(
                CASE
                    WHEN t.type = 'buy' THEN t.quantity
                    WHEN t.type = 'sell' THEN -t.quantity
                    ELSE 0
                END
            ) AS quantity,
            CASE
                WHEN SUM(CASE WHEN t.type = 'buy' THEN t.quantity ELSE 0 END) > 0
                THEN SUM(CASE WHEN t.type = 'buy' THEN t.gross_amount ELSE 0 END)
                     / SUM(CASE WHEN t.type = 'buy' THEN t.quantity ELSE 0 END)
                ELSE 0
            END AS avg_cost,
            SUM(CASE WHEN t.type = 'buy' THEN t.gross_amount ELSE 0 END) AS cost_basis,
            SUM(
                CASE
                    WHEN t.type = 'buy' THEN t.quantity
                    WHEN t.type = 'sell' THEN -t.quantity
                    ELSE 0
                END
            ) * COALESCE(lp.close, 0) AS market_value,
            0::numeric(18, 6) AS realized_pl,
            (
                SUM(
                    CASE
                        WHEN t.type = 'buy' THEN t.quantity
                        WHEN t.type = 'sell' THEN -t.quantity
                        ELSE 0
                    END
                ) * COALESCE(lp.close, 0)
            ) - SUM(CASE WHEN t.type = 'buy' THEN t.gross_amount ELSE 0 END) AS unrealized_pl,
            0::numeric(18, 6) AS yield_on_cost
        FROM transactions t
        LEFT JOIN LATERAL (
            SELECT close FROM market.prices p
            WHERE p.asset_id = t.asset_id
            ORDER BY p.date DESC
            LIMIT 1
        ) lp ON true
        WHERE t.asset_id IS NOT NULL AND t.type IN ('buy', 'sell')
        GROUP BY t.portfolio_id, t.asset_id, lp.close
        """
    )
    op.execute("CREATE UNIQUE INDEX ix_holdings_portfolio_asset ON holdings (portfolio_id, asset_id)")


def downgrade() -> None:
    op.execute("DROP MATERIALIZED VIEW IF EXISTS holdings")

    op.drop_table("fx_rates", schema="market")

    op.drop_index("ix_dividend_events_asset_id", table_name="dividend_events", schema="market")
    op.drop_table("dividend_events", schema="market")
    op.execute("DROP TYPE IF EXISTS market.dividend_frequency")
    op.execute("DROP TYPE IF EXISTS market.dividend_status")

    op.drop_table("fundamentals", schema="market")
    op.drop_table("prices", schema="market")

    op.drop_table("goals")
    op.execute("DROP TYPE IF EXISTS goal_kind")

    op.drop_table("holding_tags")
    op.drop_table("tags")

    op.drop_index("ix_transactions_asset_id", table_name="transactions")
    op.drop_index("ix_transactions_portfolio_id", table_name="transactions")
    op.drop_table("transactions")
    op.execute("DROP TYPE IF EXISTS transaction_type")

    op.drop_index("ix_assets_yahoo_symbol", table_name="assets")
    op.drop_table("assets")
    op.execute("DROP TYPE IF EXISTS asset_type")

    op.drop_table("portfolios")
    op.drop_table("user_tax_rules")

    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    op.execute("DROP SCHEMA IF EXISTS market CASCADE")
