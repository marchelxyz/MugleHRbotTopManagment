# backend/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger, Boolean, Date, func 
from sqlalchemy.dialects.postgresql import JSON
from sqlalchemy.orm import relationship
# Стало
from database import Base
from datetime import datetime

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
    telegram_photo_url = Column(String, nullable=True)
    phone_number = Column(String, nullable=False) # Было nullable=True
    date_of_birth = Column(Date, nullable=False)   # Было nullable=True
    balance = Column(Integer, default=0)
    is_admin = Column(Boolean, default=False, nullable=False)
    daily_transfer_count = Column(Integer, default=0)
    last_login_date = Column(Date, default=datetime.utcnow, nullable=False)
    ticket_parts = Column(Integer, default=0)
    tickets = Column(Integer, default=0)
    last_ticket_part_reset = Column(Date, default=datetime.utcnow)
    last_ticket_reset = Column(Date, default=datetime.utcnow)
    card_barcode = Column(String, nullable=True) # Поле для хранения данных штрих-кода
    card_balance = Column(String, nullable=True) # Поле для хранения баланса карты
    registration_date = Column(DateTime, default=func.now())


    sent_transactions = relationship("Transaction", back_populates="sender", foreign_keys="[Transaction.sender_id]")
    received_transactions = relationship("Transaction", back_populates="receiver", foreign_keys="[Transaction.receiver_id]")
    purchases = relationship("Purchase", back_populates="user")
    pending_updates = relationship("PendingUpdate", back_populates="user")

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
    image_url = Column(String, nullable=True)
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

class PendingUpdate(Base):
    __tablename__ = "pending_updates"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    old_data = Column(JSON, nullable=False) # JSON со старыми данными
    new_data = Column(JSON, nullable=False) # JSON с новыми данными
    status = Column(String, default='pending', nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="pending_updates")
