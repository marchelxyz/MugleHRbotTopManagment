# backend/app.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

# Абсолютные импорты (без точек)
from database import engine, Base
from routers import users, transactions, market, admin, banners, roulette, scheduler, telegram, sessions

# --- ПРАВИЛЬНЫЙ АСИНХРОННЫЙ СПОСОБ СОЗДАНИЯ ТАБЛИЦ ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield

app = FastAPI(lifespan=lifespan)

# Настройка CORS
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://mugle-h-rbot-top-managment-m11i.vercel.app",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключение роутеров
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
app.include_router(banners.router)
app.include_router(roulette.router)
app.include_router(scheduler.router)
app.include_router(telegram.router)
app.include_router(sessions.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the HR Spasibo API"}
