// frontend/src/pages/MarketplacePage.jsx
import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import styles from './MarketplacePage.module.css';
import PageLayout from '../components/PageLayout';
import { getCachedData, clearCache } from '../storage'; // <-- Импортируем clearCache

// --- 1. СОЗДАЕМ ОТДЕЛЬНЫЙ КОМПОНЕНТ ДЛЯ КАРТОЧКИ ТОВАРА ---
function ItemCard({ item, user, onPurchaseSuccess }) {
  // Локальное состояние для количества, по умолчанию 1
  const [quantity, setQuantity] = useState(1);
  const totalCost = item.price * quantity;
  const canAfford = user?.balance >= totalCost;

  const handlePurchase = async () => {
    if (!user) return;
    if (!window.confirm(`Купить "${item.name}" (x${quantity}) за ${totalCost} спасибок?`)) return;
    
    try {
      const response = await purchaseItem(user.id, item.id, quantity);
      onPurchaseSuccess({ balance: response.data.new_balance });
      alert(`Покупка совершена! Детали будут отправлены вам в чат с ботом.`);
    } catch (error) {
      alert(`Ошибка: ${error.response?.data?.detail || 'Не удалось совершить покупку.'}`);
    }
  };

  return (
    <div className={styles.itemCard}>
      <h2 className={styles.itemName}>{item.name}</h2>
      <p className={styles.itemDescription}>{item.description}</p>
      
      {/* --- 2. ЛОГИКА ОТОБРАЖЕНИЯ ПОЛЗУНКА --- */}
      {item.is_statix_bonus && item.stock > 1 && (
        <div className={styles.sliderContainer}>
          <input 
            type="range"
            min="1"
            max={Math.min(item.stock, 50)} // Ограничиваем максимальное значение для удобства
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value, 10))}
            className={styles.quantitySlider}
          />
          <span className={styles.quantityLabel}>Кол-во: {quantity}</span>
        </div>
      )}

      <p className={styles.itemPrice}>
        Цена: {totalCost} спасибок 
        {quantity > 1 && ` (${item.price} за шт.)`}
      </p>

      <button 
        onClick={handlePurchase} 
        className={styles.purchaseButton}
        disabled={!canAfford || item.stock < quantity}
      >
        {canAfford ? 'Купить' : 'Недостаточно средств'}
      </button>
    </div>
  );
}


// --- 3. ГЛАВНЫЙ КОМПОНЕНТ СТРАНИЦЫ ---
function MarketplacePage({ user, onPurchaseSuccess }) {
  const [items, setItems] = useState(() => getCachedData('market'));
  const [isLoading, setIsLoading] = useState(!items);
  
  useEffect(() => {
    if (!items) {
      const fetchItems = async () => {
        try {
          const response = await getMarketItems();
          setItems(response.data);
        } catch (error) { console.error("Failed to fetch market items", error); } 
        finally { setIsLoading(false); }
      };
      fetchItems();
    }
  }, [items]);

  const handlePurchaseWrapper = (newUserData) => {
    clearCache('market'); // Очищаем кэш после покупки
    onPurchaseSuccess(newUserData);
  };

  return (
    <PageLayout title="Кафетерий">
      <p>Ваш баланс: <strong>{user?.balance}</strong> спасибок</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {items.map(item => (
            <ItemCard 
              key={item.id} 
              item={item} 
              user={user} 
              onPurchaseSuccess={handlePurchaseWrapper}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}

export default MarketplacePage;
