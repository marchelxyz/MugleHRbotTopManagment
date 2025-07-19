# backend/app.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from routers import users, transactions, market, admin

app = FastAPI()

# --- НОВАЯ, БОЛЕЕ ГИБКАЯ КОНФИГУРАЦИЯ CORS ---
app.add_middleware(
    CORSMiddleware,
    # Разрешаем запросы от Vercel и его поддоменов (для превью-сборок)
    allow_origin_regex='https?://.*\.vercel\.app', 
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"], # Явно перечисляем методы
    allow_headers=["*"], # Разрешаем все заголовки
)
# --- КОНЕЦ ИЗМЕНЕНИЙ ---

@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
