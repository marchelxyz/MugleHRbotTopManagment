from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
# ИЗМЕНЕНО: убрали точки перед импортами
from database import engine
from models import Base
from routers import users, transactions, market, admin

app = FastAPI()
origins = [
    "https://mugle-h-rbot-top-managment.vercel.app", # URL вашего фронтенда
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins, # Используем наш список разрешенных адресов
    allow_credentials=True,
    allow_methods=["*"],
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
