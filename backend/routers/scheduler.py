# backend/routers/scheduler.py
from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from database import get_db, settings

router = APIRouter()

# Простая зависимость для проверки секретного ключа
async def verify_cron_secret(x_cron_secret: str = Header(...)):
    if x_cron_secret != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")

@router.post("/scheduler/run-daily-tasks", dependencies=[Depends(verify_cron_secret)])
async def run_daily_tasks(db: AsyncSession = Depends(get_db)):
    """Выполняет ежедневные задачи: начисление бонусов на ДР."""
    birthdays_processed = await crud.process_birthday_bonuses(db)
    return {"status": "ok", "birthdays_processed": birthdays_processed}

@router.post("/scheduler/run-monthly-tasks", dependencies=[Depends(verify_cron_secret)])
async def run_monthly_tasks(db: AsyncSession = Depends(get_db)):
    """Выполняет ежемесячные задачи: сброс баланса для переводов."""
    await crud.reset_monthly_balances(db)
    return {"status": "ok", "message": "Monthly transfer balances have been reset."}
