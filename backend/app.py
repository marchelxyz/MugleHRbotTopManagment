import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.base import BaseHTTPMiddleware

from config import settings
from redis_cache import redis_cache
from routers import (
    admin,
    app_settings,
    banners,
    cache,
    market,
    media_upload,
    notifications,
    roulette,
    scheduler,
    sessions,
    shared_gifts,
    telegram,
    transactions,
    users,
)
from startup_background import run_background_startup

logger = logging.getLogger(__name__)


def _is_protected_api_path(path: str) -> bool:
    """Пути REST API до завершения фоновой инициализации (SPA и статика не сюда)."""
    if path == "/run-monthly-tasks":
        return True
    prefixes = (
        "/users",
        "/admin",
        "/transactions",
        "/market",
        "/banners",
        "/roulette",
        "/scheduler",
        "/telegram",
        "/sessions",
        "/shared-gifts",
        "/cache",
        "/app-settings",
        "/notifications",
        "/points",
        "/leaderboard",
    )
    for prefix in prefixes:
        if path == prefix or path.startswith(prefix + "/"):
            return True
    return False


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Сразу отдаёт управление ASGI — порт слушается, миграции идут в фоне."""
    app.state.startup_ready = False
    app.state.startup_error = None

    async def _runner() -> None:
        try:
            await run_background_startup()
            app.state.startup_ready = True
        except Exception:
            logger.exception("Фоновая инициализация не удалась")
            app.state.startup_error = "startup_failed"

    task = asyncio.create_task(_runner())
    app.state._startup_task = task

    yield

    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

    try:
        await redis_cache.disconnect()
    except Exception as e:
        logger.error("Ошибка при отключении от Redis: %s", e)


class StartupGateMiddleware(BaseHTTPMiddleware):
    """503 на API до готовности БД; /health и статика проходят."""

    async def dispatch(self, request: Request, call_next):
        if getattr(request.app.state, "startup_ready", False):
            return await call_next(request)
        path = request.url.path
        if path == "/health" or path.startswith("/assets/"):
            return await call_next(request)
        if _is_protected_api_path(path):
            return JSONResponse(
                status_code=503,
                content={"detail": "Сервис запускается, повторите запрос позже"},
            )
        return await call_next(request)

app = FastAPI(lifespan=lifespan)

class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        path = request.url.path
        
        if path.startswith('/banners') or path.startswith('/market/items') or path.startswith('/market/statix-bonus'):
            response.headers["Cache-Control"] = "public, max-age=60"
        elif path.startswith('/leaderboard'):
            response.headers["Cache-Control"] = "public, max-age=15"
        elif path.startswith('/transactions/feed'):
            response.headers["Cache-Control"] = "public, max-age=10"
        elif request.method == "GET" and not path.startswith('/users/me') and not path.startswith('/admin'):
            response.headers["Cache-Control"] = "public, max-age=15"
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response

app.add_middleware(CacheControlMiddleware)

origins = [
    "https://mugle-h-rbot-top-managment-m11i.vercel.app",
    "https://mugle-h-rbot-top-managment.vercel.app",
    "http://localhost:8080",
]
if settings.CORS_ORIGINS.strip():
    origins = list(origins) + [
        o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(StartupGateMiddleware)

app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
app.include_router(banners.router)
app.include_router(roulette.router)
app.include_router(scheduler.router)
app.include_router(telegram.router)
app.include_router(sessions.router)
app.include_router(shared_gifts.router)
app.include_router(cache.router)
app.include_router(app_settings.router)
app.include_router(notifications.router)
app.include_router(media_upload.router)


def _static_root() -> Path:
    """Каталог со сборкой Vite (index.html и assets/)."""
    if settings.STATIC_ROOT.strip():
        return Path(settings.STATIC_ROOT)
    return Path(__file__).resolve().parent.parent / "frontend" / "dist"


def _register_spa_assets() -> None:
    """Монтирует /assets для статики SPA при SERVE_SPA."""
    if not settings.SERVE_SPA:
        return
    root = _static_root()
    assets_dir = root / "assets"
    if not root.is_dir() or not assets_dir.is_dir():
        logger.warning(
            "SERVE_SPA: не найдено %s или %s — раздача статики отключена",
            root,
            assets_dir,
        )
        return
    app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="spa_assets")


_register_spa_assets()


@app.get("/health")
def health_check(request: Request) -> dict[str, str]:
    """Проверка для балансировщика и платформ деплоя (Timeweb и др.).

    Во время миграций возвращает 200 без ожидания БД. При фатальной ошибке
    фоновой инициализации — 503, чтобы деплой не считался успешным.
    """
    if getattr(request.app.state, "startup_error", None):
        raise HTTPException(status_code=503, detail="Startup failed")
    return {"status": "ok"}


@app.get("/")
def read_root():
    if settings.SERVE_SPA:
        index = _static_root() / "index.html"
        if index.is_file():
            return FileResponse(index)
    return {"message": "Welcome to the HR Spasibo API"}


@app.get("/{full_path:path}")
async def spa_fallback(full_path: str):
    """Клиентские маршруты React — отдаём index.html при SERVE_SPA."""
    del full_path
    if not settings.SERVE_SPA:
        raise HTTPException(status_code=404, detail="Not found")
    index = _static_root() / "index.html"
    if index.is_file():
        return FileResponse(index)
    raise HTTPException(status_code=404, detail="Not found")
