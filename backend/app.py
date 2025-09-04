# backend/app.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import engine
from models import Base
from routers import users, transactions, market, admin, banners, scheduler, telegram, roulette

app = FastAPI()

# Мы временно убираем middleware для логирования,
# чтобы увидеть оригинальную ошибку от FastAPI
# @app.middleware("http")
# async def log_headers(request: Request, call_next):
#     print(f"!!! DEBUG: Incoming request with headers: {request.headers}")
#     response = await call_next(request)
#     return response

# Конфигурация CORS (оставляем ее как есть)
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r'https?://.*\.vercel\.app',
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
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
app.include_router(banners.router)
app.include_router(telegram.router)
app.include_router(roulette.router)
