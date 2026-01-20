from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import models
import schemas


async def get_app_settings(db: AsyncSession):
    result = await db.execute(
        select(models.AppSettings).order_by(models.AppSettings.id.asc()).limit(1)
    )
    settings_row = result.scalars().first()
    if settings_row:
        return settings_row

    settings_row = models.AppSettings(season_theme="summer")
    db.add(settings_row)
    await db.commit()
    await db.refresh(settings_row)
    return settings_row


async def update_app_settings(db: AsyncSession, settings_data: schemas.AppSettingsUpdate):
    settings_row = await get_app_settings(db)
    update_data = settings_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings_row, key, value)

    await db.commit()
    await db.refresh(settings_row)
    return settings_row
