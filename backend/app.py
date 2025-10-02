# backend/app.py

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import engine, Base
from .routers import users, transactions, market, admin, banners, roulette, scheduler, telegram

# Создаем все таблицы в базе данных при старте (для разработки)
Base.metadata.create_all(bind=engine)

app = FastAPI()

# Настройка CORS
origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:5173",
    "https://mugle-h-rbot-top-managment-m11i.vercel.app",
    "*" # Оставляем для гибкости
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ПРАВИЛЬНОЕ ПОДКЛЮЧЕНИЕ РОУТЕРОВ ---
# Префиксы теперь заданы внутри каждого файла роутера
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
app.include_router(banners.router)
app.include_router(roulette.router)
app.include_router(scheduler.router)
app.include_router(telegram.router)

@app.get("/")
def read_root():
    return {"message": "Welcome to the HR Spasibo API"}
