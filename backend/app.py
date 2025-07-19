# backend/app.py

from fastapi import FastAPI, Request # <--- ВОТ ПРАВИЛЬНЫЙ ИМПОРТ
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from routers import users, transactions, market, admin

app = FastAPI()

# --- Наш "шпионский" код для логирования ---
@app.middleware("http")
async def log_headers(request: Request, call_next):
    # Выводим в лог все заголовки входящего запроса
    print(f"!!! DEBUG: Incoming request with headers: {request.headers}")
    response = await call_next(request)
    return response
# --- Конец шпионского кода ---

# Конфигурация CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r'https?://.*\.vercel\.app', # Добавил 'r' для корректной строки
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
