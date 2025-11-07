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
    try:
        birthdays_processed = await crud.process_birthday_bonuses(db)
        await crud.reset_tickets(db)
        reset_result = await crud.reset_daily_transfer_limits(db)
        return {
            "status": "ok", 
            "birthdays_processed": birthdays_processed,
            "daily_transfer_limits_reset": reset_result
        }
    except Exception as e:
        print(f"Error during daily tasks: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing daily tasks: {str(e)}")

@router.post("/run-monthly-tasks")
async def run_monthly_tasks(
    x_cron_secret: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if x_cron_secret != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")
    
    # --- ДОБАВЛЯЕМ ВЫЗОВ НОВОЙ ФУНКЦИИ ---
    try:
        await crud.generate_monthly_leaderboard_banners(db)
        return {"status": "monthly leaderboard banners generated"}
    except Exception as e:
        print(f"Error during monthly tasks: {e}")
        raise HTTPException(status_code=500, detail="Error processing monthly tasks")
