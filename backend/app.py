# backend/app.py

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware

# Абсолютные импорты (без точек)
from database import engine, Base
from routers import users, transactions, market, admin, banners, roulette, scheduler, telegram, sessions, shared_gifts, auth

# --- ПРАВИЛЬНЫЙ АСИНХРОННЫЙ СПОСОБ СОЗДАНИЯ ТАБЛИЦ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan)

# Middleware для кеширования API ответов
class CacheControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Определяем пути, которые нужно кешировать
        path = request.url.path
        
        # Кешируем статические данные на 5 минут
        if path.startswith('/banners') or path.startswith('/market/items') or path.startswith('/market/statix-bonus'):
            response.headers["Cache-Control"] = "public, max-age=300"
        # Кешируем данные лидерборда на 1 минуту
        elif path.startswith('/leaderboard'):
            response.headers["Cache-Control"] = "public, max-age=60"
        # Кешируем фид транзакций на 30 секунд
        elif path.startswith('/transactions/feed'):
            response.headers["Cache-Control"] = "public, max-age=30"
        # Для остальных GET запросов - короткое кеширование
        elif request.method == "GET" and not path.startswith('/users/me') and not path.startswith('/admin'):
            response.headers["Cache-Control"] = "public, max-age=60"
        # Для POST/PUT/DELETE - не кешируем
        else:
            response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
            response.headers["Pragma"] = "no-cache"
            response.headers["Expires"] = "0"
        
        return response

app.add_middleware(CacheControlMiddleware)

# Настройка CORS
origins = [
    # 1. Адрес твоего рабочего приложения (ПРОДАКШЕН)
    "https://mugle-h-rbot-top-managment-m11i.vercel.app",

    "https://mugle-h-rbot-top-managment.vercel.app",
    
    # 2. Адрес для локальной разработки (РАЗРАБОТКА)
    "http://localhost:8080", # (или 3000, 8000 в зависимости от твоих настроек)
    "http://localhost:5173", # Vite dev server
    "http://localhost:3000", # React dev server
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(auth.router)
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

@app.get("/")
def read_root():
    return {"message": "Welcome to the HR Spasibo API"}
