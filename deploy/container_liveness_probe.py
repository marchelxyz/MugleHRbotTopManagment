"""HTTP GET liveness для Docker HEALTHCHECK (loopback без имени localhost).

Пробует по очереди **127.0.0.1** и **[::1]**: uvicorn может слушать только IPv4
или только IPv6 (`--host ::`), а внутри контейнера одно из соединений может не
достучаться до сокета в зависимости от ядра/Docker.
"""

from __future__ import annotations

import os
import sys
import urllib.error
import urllib.request


def _get_health_ok(url: str) -> bool:
    """Возвращает True, если GET даёт HTTP 200."""
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            return resp.status == 200
    except (OSError, urllib.error.URLError, ValueError):
        return False


def _loopback_health_urls(port: str) -> list[str]:
    """URL-ы для проверки `/health` на loopback IPv4 и IPv6."""
    return [
        f"http://127.0.0.1:{port}/health",
        f"http://[::1]:{port}/health",
    ]


def main() -> int:
    """Успех, если хотя бы один loopback-URL отвечает 200 на ``/health``."""
    port = (os.environ.get("PORT") or "80").strip() or "80"
    for url in _loopback_health_urls(port):
        if _get_health_ok(url):
            return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
