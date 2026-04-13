"""Настройка логирования: время с датой/днём недели, цвета уровней в TTY.

Цвета (только если stderr — терминал и не задан NO_COLOR):
  SUCCESS  — зелёный (важные успехи)
  INFO     — синий (обычные сообщения)
  WARNING  — жёлтый
  ERROR/CRITICAL — красный
  DEBUG    — серый

В панелях облака логи часто идут в «плоский» текст: ANSI-коды не красят или видны
как мусор — задайте NO_COLOR=1 или смотрите логи через ``docker logs`` в терминале.
"""

from __future__ import annotations

import logging
import os
import sys
import threading
from datetime import datetime, timezone
from typing import Final
from zoneinfo import ZoneInfo

# Уровень «успех» — между INFO и WARNING (зелёный в консоли).
SUCCESS_LEVEL: Final[int] = 25


def _register_success_level() -> None:
    """Регистрирует уровень SUCCESS и метод ``Logger.success()``."""
    logging.addLevelName(SUCCESS_LEVEL, "SUCCESS")

    def success(self: logging.Logger, msg: object, *args: object, **kwargs: object) -> None:
        if self.isEnabledFor(SUCCESS_LEVEL):
            self._log(SUCCESS_LEVEL, msg, args, **kwargs)

    logging.Logger.success = success  # type: ignore[attr-defined, assignment]


class _DayBreakState:
    """Потокобезопасная смена календарной даты для разделителя в логе."""

    lock: Final[threading.Lock] = threading.Lock()
    last_key: str | None = None


def _resolve_tz() -> datetime.tzinfo:
    """Часовой пояс для меток времени: TZ из окружения или UTC."""
    raw = (os.environ.get("TZ") or "").strip()
    if not raw:
        return timezone.utc
    try:
        return ZoneInfo(raw)
    except Exception:
        return timezone.utc


def _format_timestamp(record: logging.LogRecord, *, use_utc: bool) -> str:
    """Дата, день недели, время и смещение (как на Railway: однозначная шкала времени)."""
    dt_utc = datetime.fromtimestamp(record.created, tz=timezone.utc)
    tz = timezone.utc if use_utc else _resolve_tz()
    dt = dt_utc if use_utc else dt_utc.astimezone(tz)
    # %a — день недели (локаль зависит от LANG в контейнере)
    return dt.strftime("%Y-%m-%d %a %H:%M:%S %z")


class ColoredConsoleFormatter(logging.Formatter):
    """Форматер: цвет по уровню, дата/время, опциональный разделитель при смене дня."""

    RESET = "\033[0m"
    DIM = "\033[90m"
    COLORS = {
        logging.DEBUG: "\033[36m",  # cyan — детали
        SUCCESS_LEVEL: "\033[32m",  # green
        logging.INFO: "\033[34m",  # blue — обычный поток
        logging.WARNING: "\033[33m",  # yellow
        logging.ERROR: "\033[31m",  # red
        logging.CRITICAL: "\033[1;31m",  # bold red
    }

    def __init__(
        self,
        *,
        use_color: bool,
        use_utc: bool,
        day_breaks: bool,
    ) -> None:
        super().__init__(datefmt=None)
        self._use_color = use_color
        self._use_utc = use_utc
        self._day_breaks = day_breaks

    def format(self, record: logging.LogRecord) -> str:
        ts = _format_timestamp(record, use_utc=self._use_utc)
        date_key = ts[:10]

        prefix = ""
        if self._day_breaks:
            with _DayBreakState.lock:
                if _DayBreakState.last_key != date_key:
                    line = f"──────── {date_key} ────────"
                    if _DayBreakState.last_key is not None:
                        prefix = "\n"
                    if self._use_color:
                        prefix += f"{self.DIM}{line}{self.RESET}\n"
                    else:
                        prefix += f"{line}\n"
                    _DayBreakState.last_key = date_key

        level = record.levelno
        color = self.COLORS.get(level, self.RESET) if self._use_color else ""
        reset = self.RESET if self._use_color else ""

        level_name = logging.getLevelName(level)
        if isinstance(level_name, str):
            level_pad = f"{level_name:<8}"
        else:
            level_pad = f"L{level:<7}"

        name = record.name
        if len(name) > 28:
            name = name[:25] + "..."

        msg = record.getMessage()
        line_body = f"{ts} │ {level_pad} │ {name:28} │ {msg}"

        if self._use_color and color:
            line_body = f"{color}{line_body}{reset}"

        if record.exc_info:
            line_body += "\n" + self.formatException(record.exc_info)

        return prefix + line_body


class PlainFormatter(logging.Formatter):
    """Тот же вид без ANSI (файлы, NO_COLOR, не-TTY)."""

    def __init__(self, *, use_utc: bool, day_breaks: bool) -> None:
        super().__init__(datefmt=None)
        self._inner = ColoredConsoleFormatter(
            use_color=False, use_utc=use_utc, day_breaks=day_breaks
        )

    def format(self, record: logging.LogRecord) -> str:
        return self._inner.format(record)


def setup_application_logging() -> None:
    """Вызывать один раз при старте процесса (после импорта ``logging``)."""
    _register_success_level()

    use_utc = os.environ.get("LOG_USE_UTC", "").lower() in ("1", "true", "yes")
    day_breaks = os.environ.get("LOG_DAY_BREAKS", "1").lower() not in ("0", "false", "no")
    no_color = os.environ.get("NO_COLOR", "") != "" or not sys.stderr.isatty()
    level_name = (os.environ.get("LOG_LEVEL") or "INFO").upper()
    level = getattr(logging, level_name, logging.INFO)

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(level)

    if no_color:
        formatter: logging.Formatter = PlainFormatter(use_utc=use_utc, day_breaks=day_breaks)
    else:
        formatter = ColoredConsoleFormatter(
            use_color=True, use_utc=use_utc, day_breaks=day_breaks
        )

    handler = logging.StreamHandler(sys.stderr)
    handler.setFormatter(formatter)
    root.addHandler(handler)

    for name in ("uvicorn", "uvicorn.error", "uvicorn.access"):
        lg = logging.getLogger(name)
        lg.handlers.clear()
        lg.propagate = True

    logging.captureWarnings(True)
