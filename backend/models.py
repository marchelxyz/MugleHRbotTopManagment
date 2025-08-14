# backend/models.py

from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger, Boolean, Date
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False)
    position = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    username = Column(String, nullable=True)
    phone_number = Column(String, nullable=True)
    date_of_birth = Column(Date, nullable=True)
    balance = Column(Integer, default=0)
    is_admin = Column(Boolean, default=False, nullable=False)
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

    # --- ИЗМЕНЕНИЕ: ДОБАВЛЯЕМ ПРАВИЛО ЖАДНОЙ ЗАГРУЗКИ ---
    sender = relationship(
        "User", back_populates="sent_transactions", foreign_keys=[sender_id], lazy='selectin'
    )
    receiver = relationship(
        "User", back_populates="received_transactions", foreign_keys=[receiver_id], lazy='selectin'
    )
    # --- КОНЕЦ ИЗМЕНЕНИЙ ---

class MarketItem(Base):
    __tablename__ = "market_items"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Integer, nullable=False)
    stock = Column(Integer, default=0)
    # Убираем lazy='selectin' отсюда
    purchases = relationship("Purchase", back_populates="item")

class Purchase(Base):
    __tablename__ = "purchases"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("market_items.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    user = relationship("User", back_populates="purchases")
    # Убираем lazy='selectin' и отсюда
    item = relationship("MarketItem", back_populates="purchases")
