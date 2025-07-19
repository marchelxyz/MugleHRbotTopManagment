from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, BigInteger # <-- Добавили BigInteger
from sqlalchemy.orm import relationship, declarative_base
from datetime import datetime

# Базовый класс для декларативных моделей
Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    telegram_id = Column(BigInteger, unique=True, index=True, nullable=False) # <-- Заменили String
    position = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    department = Column(String, nullable=False)
    balance = Column(Integer, default=0)

    sent_transactions = relationship(
        "Transaction", back_populates="sender", foreign_keys="[Transaction.sender_id]"
    )
    received_transactions = relationship(
        "Transaction", back_populates="receiver", foreign_keys="[Transaction.receiver_id]"
    )
    purchases = relationship("Purchase", back_populates="user")

class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    receiver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    amount = Column(Integer, nullable=False)
    message = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

    sender = relationship(
        "User", back_populates="sent_transactions", foreign_keys=[sender_id]
    )
    receiver = relationship(
        "User", back_populates="received_transactions", foreign_keys=[receiver_id]
    )

class MarketItem(Base):
    __tablename__ = "market_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    price = Column(Integer, nullable=False)
    stock = Column(Integer, default=0)

    purchases = relationship("Purchase", back_populates="item")

class Purchase(Base):
    __tablename__ = "purchases"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    item_id = Column(Integer, ForeignKey("market_items.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="purchases")
    item = relationship("MarketItem", back_populates="purchases")
