# backend/app.py
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
# --- 1. ДОБАВЛЯЕМ ИМПОРТ ДЛЯ CORS ---
from fastapi.middleware.cors import CORSMiddleware
from routers import users, transactions, market, admin, banners, scheduler, telegram, roulette, uploads
from database import Base, engine
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all) # Для удаления таблиц
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan)

# --- 2. ДОБАВЛЯЕМ НАСТРОЙКУ CORS ---
# Указываем, каким адресам разрешено обращаться к нашему API
origins = [
    "*" # Временно разрешаем всем, для безопасности лучше указать конкретный URL твоего фронтенда
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"], # Разрешаем все методы (GET, POST и т.д.)
    allow_headers=["*"], # Разрешаем все заголовки
)
# --- КОНЕЦ НАСТРОЙКИ CORS ---


app.mount("/static", StaticFiles(directory="static"), name="static")

# Подключаем роутеры
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
app.include_router(banners.router)
app.include_router(scheduler.router)
app.include_router(telegram.router)
app.include_router(roulette.router)
app.include_router(uploads.router)
