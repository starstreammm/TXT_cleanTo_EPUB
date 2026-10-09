import logging
import sys

from logging.handlers import TimedRotatingFileHandler
from datetime import datetime, timezone

from models import DATA_PATH

LOG_PATH = DATA_PATH / "logs" / "api.log"
LOG_PATH.parent.mkdir(parents=True, exist_ok=True)


class LoggerMeta(type):

    def __getattr__(cls, name):
        if cls._log is None:
            raise RuntimeError("Logger not initialized.")

        return getattr(cls._log, name)


class LoggerBase(metaclass=LoggerMeta):

    _log: logging.Logger | None = None

    @classmethod
    def init(cls) -> None:
        # Get logger
        logger = logging.getLogger("api_log")
        logger.setLevel(logging.DEBUG)

        # File Handler
        file_handler = TimedRotatingFileHandler(
            LOG_PATH, when="midnight", interval=1, backupCount=7, encoding="utf-8"
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(
            logging.Formatter(
                "{asctime}-{levelname:^7}-{filename}-{lineno}: {message}",
                style="{",
                datefmt=r"%Y-%m-%d %H:%M:%S",
            )
        )
        logger.addHandler(file_handler)

        # Stderr handler
        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setLevel(logging.ERROR)
        stderr_handler.setFormatter(
            logging.Formatter(
                "{asctime}-{levelname}-{filename}-{lineno}: {message}", style="{"
            )
        )
        logger.addHandler(stderr_handler)

        # Stdout handler
        stdout_handler = logging.StreamHandler(sys.stdout)
        stdout_handler.setLevel(logging.WARNING)
        stdout_handler.setFormatter(
            logging.Formatter("{levelname:^7}: {message}", style="{")
        )
        logger.addHandler(stdout_handler)

        cls._log = logger
        cls.info(f"""
--------Program Start--------
UTC Time: {datetime.now(timezone.utc).isoformat()}
Local Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
""")
