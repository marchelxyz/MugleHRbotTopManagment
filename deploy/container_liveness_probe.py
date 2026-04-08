"""HTTP GET liveness для Docker HEALTHCHECK на 127.0.0.1.

Не использует имя ``localhost`` (в контейнере оно может указывать на ``::1``,
что расходится с привязкой только IPv4). Timeweb при ``HEALTHCHECK`` в образе
может опираться на эту инструкцию вместо неявной пробы.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request


def main() -> int:
    """Выполняет GET ``/health`` на 127.0.0.1 и порту ``PORT``."""
    port = (os.environ.get("PORT") or "80").strip() or "80"
    url = f"http://127.0.0.1:{port}/health"
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            return 0 if resp.status == 200 else 1
    except (OSError, urllib.error.URLError, ValueError):
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
