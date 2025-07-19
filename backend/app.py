python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine
from backend.models import Base
from backend.routers import users, transactions, market, admin

app = FastAPI()

# Настройка CORS (при необходимости)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # или конкретные домены
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    # При старте создаём все таблицы в БД
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Подключение роутеров без лишних markdown-фенсов
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
