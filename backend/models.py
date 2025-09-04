# backend/models.py
import io
import zipfile
import json
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger, Boolean, Date
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=False)
    status = Column(String, default='pending', nullable=False)
    position = Column(String, nullable=False)
    department = Column(String, nullable=False)
    username = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    balance = Column(Integer, default=0)
    is_admin = Column(Boolean, default=False, nullable=False)
    daily_transfer_count = Column(Integer, default=0)
    last_login_date = Column(Date, default=datetime.utcnow, nullable=False)
    ticket_parts = Column(Integer, default=0)
    tickets = Column(Integer, default=0)
    last_ticket_part_reset = Column(Date, default=datetime.utcnow)
    last_ticket_reset = Column(Date, default=datetime.utcnow)
    card_barcode = Column(String, nullable=True) # Поле для хранения данных штрих-кода

    sent_transactions = relationship("Transaction", back_populates="sender", foreign_keys="[Transaction.sender_id]")
    received_transactions = relationship("Transaction", back_populates="receiver", foreign_keys="[Transaction.receiver_id]")
    purchases = relationship("Purchase", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"
    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    message = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    sender = relationship("User", back_populates="sent_transactions", foreign_keys=[sender_id], lazy='selectin')
    receiver = relationship("User", back_populates="received_transactions", foreign_keys=[receiver_id], lazy='selectin')

class MarketItem(Base):
    __tablename__ = "market_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Integer, nullable=False)
    price_rub = Column(Integer, nullable=False) 
    stock = Column(Integer, default=0)
    is_archived = Column(Boolean, default=False, nullable=False)
    archived_at = Column(DateTime, nullable=True)
    purchases = relationship("Purchase", back_populates="item")

class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("market_items.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="purchases")
    item = relationship("MarketItem", back_populates="purchases")

class Banner(Base):
    __tablename__ = "banners"
    id = Column(Integer, primary_key=True, index=True)
    image_url = Column(String, nullable=False)
    link_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    position = Column(String, default='feed', nullable=False)

class RouletteWin(Base):
    __tablename__ = "roulette_wins"
    id = Column(Integer, primary_key=True, index=True)
    amount = Column(Integer, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user = relationship("User", lazy='selectin')

# --- ДОБАВЬТЕ ЭТИ НОВЫЕ ФУНКЦИИ В КОНЕЦ ФАЙЛА ---
async def process_pkpass_file(db: AsyncSession, user_id: int, file_content: bytes):
    """
    Обрабатывает файл .pkpass, извлекает штрих-код и сохраняет его для пользователя.
    """
    user = await db.get(models.User, user_id)
    if not user:
        return None

    try:
        # Открываем архив из байтов в памяти
        with zipfile.ZipFile(io.BytesIO(file_content), 'r') as pass_zip:
            # Читаем файл pass.json
            pass_json_bytes = pass_zip.read('pass.json')
            pass_data = json.loads(pass_json_bytes)
            
            # Ищем данные штрих-кода (самое вероятное место)
            barcode_data = pass_data.get('barcode', {}).get('message')
            if not barcode_data:
                raise ValueError("Barcode data not found in pass.json")
            
            user.card_barcode = barcode_data
            await db.commit()
            await db.refresh(user)
            return user
            
    except Exception as e:
        print(f"Error processing pkpass file: {e}")
        return None

async def delete_user_card(db: AsyncSession, user_id: int):
    """Удаляет данные карты у пользователя."""
    user = await db.get(models.User, user_id)
    if user:
        user.card_barcode = None
        await db.commit()
        await db.refresh(user)
    return user
