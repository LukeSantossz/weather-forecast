"""Structured logging setup for the weather_forecast pipeline.

Named ``logging_setup`` (not ``logging``) to avoid shadowing the stdlib module.
"""

from __future__ import annotations

import logging

_LOG_FORMAT = "%(asctime)s %(levelname)s %(name)s: %(message)s"
_ROOT_NAME = "weather_forecast"


def configure_logging(level: str = "INFO") -> None:
    """Configure the package logger with a stream handler and a shared format.

    Idempotent: a handler is added only if the package logger has none.
    """
    logger = logging.getLogger(_ROOT_NAME)
    logger.setLevel(level)
    if not logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter(_LOG_FORMAT))
        logger.addHandler(handler)


def get_logger(name: str) -> logging.Logger:
    """Return a named logger (use a ``weather_forecast.*`` name)."""
    return logging.getLogger(name)
