```python
from fastapi import FastAPI
from backend.database import engine
from backend.models import Base
from backend.routers import users, transactions, market, admin

app = FastAPI()

@app.on_event("startup")
async def on_startup():
    # Создание таблиц при старте
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

# Подключение роутеров
app.include_router(users.router)
app.include_router(transactions.router)
app.include_router(market.router)
app.include_router(admin.router)
```
