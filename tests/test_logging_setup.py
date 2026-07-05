"""Unit tests for weather_forecast.logging_setup."""

import logging

from weather_forecast.logging_setup import configure_logging, get_logger


def test_get_logger_returns_named_logger() -> None:
    log = get_logger("weather_forecast.test")
    assert isinstance(log, logging.Logger)
    assert log.name == "weather_forecast.test"


def test_configure_logging_sets_level() -> None:
    configure_logging("DEBUG")
    assert logging.getLogger("weather_forecast").level == logging.DEBUG
