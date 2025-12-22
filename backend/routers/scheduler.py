from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.ext.asyncio import AsyncSession
import crud
from database import get_db, settings

router = APIRouter()

async def verify_cron_secret(x_cron_secret: str = Header(...)):
    if x_cron_secret != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")

@router.post("/scheduler/run-daily-tasks", dependencies=[Depends(verify_cron_secret)])
async def run_daily_tasks(db: AsyncSession = Depends(get_db)):
    birthdays_processed = await crud.process_birthday_bonuses(db)
    await crud.reset_tickets(db)
    await crud.reset_daily_transfer_limits(db)
    # Проверяем и отправляем отложенные учетные данные
    credentials_result = await crud.send_pending_credentials_emails(db)
    return {
        "status": "ok",
        "birthdays_processed": birthdays_processed,
        "pending_credentials": credentials_result
    }

@router.post("/scheduler/send-pending-credentials", dependencies=[Depends(verify_cron_secret)])
async def send_pending_credentials(db: AsyncSession = Depends(get_db)):
    """
    Проверяет и отправляет отложенные учетные данные пользователям, чьи email были подтверждены.
    Можно вызывать отдельно или как часть ежедневных задач.
    """
    try:
        result = await crud.send_pending_credentials_emails(db)
        return {"status": "ok", **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error sending pending credentials: {str(e)}")

@router.post("/run-monthly-tasks")
async def run_monthly_tasks(
    x_cron_secret: str = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if x_cron_secret != settings.ADMIN_API_KEY:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid secret")
    
    try:
        await crud.generate_monthly_leaderboard_banners(db)
        return {"status": "monthly leaderboard banners generated"}
    except Exception as e:
        print(f"Error during monthly tasks: {e}")
        raise HTTPException(status_code=500, detail="Error processing monthly tasks")
