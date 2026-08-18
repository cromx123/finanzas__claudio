from __future__ import annotations

import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from sqlalchemy import select

from app.core.config import settings
from app.core.db import SessionLocal
from app.models.portfolio import Asset
from app.modules.fx import service as fx_service
from app.modules.ingestion.providers.yahoo import YahooProvider
from app.modules.ingestion.service import ingest_daily_price

logger = logging.getLogger(__name__)


def _parse_cron(expression: str) -> dict[str, str]:
    minute, hour, day, month, day_of_week = expression.split()
    return {
        "minute": minute,
        "hour": hour,
        "day": day,
        "month": month,
        "day_of_week": day_of_week,
    }


def _ingest_matching(predicate) -> None:
    provider = YahooProvider()
    today = date.today()
    with SessionLocal() as db:
        for asset in db.scalars(select(Asset)):
            if not predicate(asset.yahoo_symbol):
                continue
            try:
                ingest_daily_price(db, provider, asset, today)
            except Exception:
                logger.exception("failed to ingest price for %s", asset.yahoo_symbol)


def ingest_santiago_close() -> None:
    _ingest_matching(lambda symbol: symbol.endswith(".SN"))


def ingest_nyse_close() -> None:
    _ingest_matching(lambda symbol: not symbol.endswith((".SN", ".MC")))


def refresh_fx_rates() -> None:
    provider = YahooProvider()
    with SessionLocal() as db:
        try:
            fx_service.refresh_rates_from_yahoo(db, provider)
        except Exception:
            logger.exception("failed to refresh fx rates")


def build_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler(timezone=settings.ingest_tz)
    scheduler.add_job(
        ingest_santiago_close,
        CronTrigger(**_parse_cron(settings.ingest_cron_santiago), timezone="America/Santiago"),
        id="ingest_santiago_close",
        replace_existing=True,
    )
    scheduler.add_job(
        ingest_nyse_close,
        CronTrigger(**_parse_cron(settings.ingest_cron_nyse), timezone="America/New_York"),
        id="ingest_nyse_close",
        replace_existing=True,
    )
    scheduler.add_job(
        refresh_fx_rates,
        CronTrigger(**_parse_cron(settings.ingest_cron_nyse), timezone="America/New_York"),
        id="refresh_fx_rates",
        replace_existing=True,
    )
    return scheduler
