# backend/crud/shared_gifts.py

from typing import List, Optional
from datetime import datetime, date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc, and_, or_
import models
import schemas
from config import settings
from bot import send_telegram_message
import uuid


async def create_shared_gift_invitation(db: AsyncSession, invitation: schemas.CreateSharedGiftInvitationRequest, user_id: int):
    """Создать приглашение на совместный подарок"""
    user = await db.get(models.User, user_id)
    if not user:
        return None
    
    # Получаем товар
    item = await db.get(models.MarketItem, invitation.item_id)
    if not item or not item.is_active:
        return {"success": False, "message": "Товар не найден или неактивен"}
    
    if not item.is_shared_gift:
        return {"success": False, "message": "Товар не поддерживает совместные подарки"}
    
    # Проверяем баланс
    if user.balance < item.price_spasibki:
        return {"success": False, "message": "Недостаточно спасибок"}
    
    # Создаем приглашение
    invitation_code = str(uuid.uuid4())[:8]
    db_invitation = models.SharedGiftInvitation(
        item_id=invitation.item_id,
        creator_id=user_id,
        invitation_code=invitation_code,
        max_participants=invitation.max_participants,
        expires_at=datetime.now() + timedelta(hours=24)  # Приглашение действует 24 часа
    )
    
    db.add(db_invitation)
    await db.commit()
    await db.refresh(db_invitation)
    
    return {
        "success": True,
        "invitation_id": db_invitation.id,
        "invitation_code": invitation_code,
        "expires_at": db_invitation.expires_at
    }


async def get_shared_gift_invitation(db: AsyncSession, invitation_code: str):
    """Получить приглашение по коду"""
    result = await db.execute(
        select(models.SharedGiftInvitation)
        .where(models.SharedGiftInvitation.invitation_code == invitation_code)
    )
    return result.scalars().first()


async def accept_shared_gift_invitation(db: AsyncSession, invitation_id: int, user_id: int):
    """Принять приглашение на совместный подарок"""
    invitation = await db.get(models.SharedGiftInvitation, invitation_id)
    if not invitation:
        return {"success": False, "message": "Приглашение не найдено"}
    
    if invitation.expires_at < datetime.now():
        return {"success": False, "message": "Приглашение истекло"}
    
    if invitation.status != "pending":
        return {"success": False, "message": "Приглашение уже обработано"}
    
    user = await db.get(models.User, user_id)
    if not user:
        return {"success": False, "message": "Пользователь не найден"}
    
    # Проверяем, не является ли пользователь создателем
    if user_id == invitation.creator_id:
        return {"success": False, "message": "Нельзя принять собственное приглашение"}
    
    # Получаем товар
    item = await db.get(models.MarketItem, invitation.item_id)
    if not item:
        return {"success": False, "message": "Товар не найден"}
    
    # Проверяем баланс
    if user.balance < item.price_spasibki:
        return {"success": False, "message": "Недостаточно спасибок"}
    
    # Обновляем статус приглашения
    invitation.status = "accepted"
    invitation.accepted_by_id = user_id
    
    # Создаем покупку
    db_purchase = models.Purchase(
        user_id=user_id,
        item_id=item.id,
        amount=item.price_spasibki,
        is_shared_gift=True,
        shared_gift_invitation_id=invitation_id
    )
    
    # Обновляем баланс
    user.balance -= item.price_spasibki
    
    db.add(db_purchase)
    db.add(user)
    await db.commit()
    await db.refresh(db_purchase)
    
    # Уведомление создателя
    try:
        creator = await db.get(models.User, invitation.creator_id)
        if creator:
            notification_text = (
                f"🎉 *Ваше приглашение принято!*\n\n"
                f"👤 *Пользователь:* {user.first_name} {user.last_name}\n"
                f"🎁 *Товар:* {item.name}\n"
                f"💰 *Сумма:* {item.price_spasibki} спасибок"
            )
            
            await send_telegram_message(
                chat_id=creator.telegram_id,
                text=notification_text
            )
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return {
        "success": True,
        "purchase_id": db_purchase.id,
        "message": "Приглашение принято"
    }


async def reject_shared_gift_invitation(db: AsyncSession, invitation_id: int, user_id: int):
    """Отклонить приглашение на совместный подарок"""
    invitation = await db.get(models.SharedGiftInvitation, invitation_id)
    if not invitation:
        return {"success": False, "message": "Приглашение не найдено"}
    
    if invitation.status != "pending":
        return {"success": False, "message": "Приглашение уже обработано"}
    
    invitation.status = "rejected"
    invitation.rejected_by_id = user_id
    
    await db.commit()
    
    return {"success": True, "message": "Приглашение отклонено"}


async def refund_shared_gift_purchase(db: AsyncSession, purchase_id: int):
    """Возврат средств за совместный подарок"""
    purchase = await db.get(models.Purchase, purchase_id)
    if not purchase or not purchase.is_shared_gift:
        return {"success": False, "message": "Покупка не найдена"}
    
    user = await db.get(models.User, purchase.user_id)
    if not user:
        return {"success": False, "message": "Пользователь не найден"}
    
    # Возвращаем средства
    user.balance += purchase.amount
    
    # Удаляем покупку
    await db.delete(purchase)
    await db.commit()
    
    return {"success": True, "message": "Средства возвращены"}


async def get_user_shared_gift_invitations(db: AsyncSession, user_id: int):
    """Получить приглашения пользователя"""
    result = await db.execute(
        select(models.SharedGiftInvitation)
        .where(
            or_(
                models.SharedGiftInvitation.creator_id == user_id,
                models.SharedGiftInvitation.accepted_by_id == user_id
            )
        )
        .order_by(desc(models.SharedGiftInvitation.created_at))
    )
    return result.scalars().all()


async def cleanup_expired_shared_gift_invitations(db: AsyncSession):
    """Очистить истекшие приглашения"""
    now = datetime.now()
    
    # Находим истекшие приглашения
    result = await db.execute(
        select(models.SharedGiftInvitation)
        .where(
            and_(
                models.SharedGiftInvitation.expires_at < now,
                models.SharedGiftInvitation.status == "pending"
            )
        )
    )
    expired_invitations = result.scalars().all()
    
    # Обновляем статус
    for invitation in expired_invitations:
        invitation.status = "expired"
    
    await db.commit()
    
    return {"expired_count": len(expired_invitations)}
