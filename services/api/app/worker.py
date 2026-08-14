from __future__ import annotations

import logging
import time

from app.modules.ingestion.scheduler import build_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def main() -> None:
    scheduler = build_scheduler()
    scheduler.start()
    logger.info("ingestion worker started")
    try:
        while True:
            time.sleep(60)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()


if __name__ == "__main__":
    main()
