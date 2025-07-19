// frontend/src/pages/MarketplacePage.jsx
import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import styles from './MarketplacePage.module.css'; // 1. Импортируем стили

const tg = window.Telegram.WebApp;

function MarketplacePage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const currentUserId = tg.initDataUnsafe?.user?.id;

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getMarketItems();
        setItems(response.data);
      } catch (error) {
        console.error("Failed to fetch market items", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, []);

  const handlePurchase = async (itemId) => {
    if (!window.confirm("Вы уверены, что хотите купить этот товар?")) return;
    try {
      const response = await purchaseItem(currentUserId, itemId);
      alert(`Покупка совершена успешно!`);
      // Тут можно добавить логику обновления баланса пользователя
      // или обновления количества товаров, если они конечны
    } catch (error) {
      alert(`Ошибка: ${error.response?.data?.detail || 'Не удалось совершить покупку.'}`);
    }
  };
  
  return (
    // 2. Применяем классы
    <div className={styles.page}>
      <h1>🛒 Магазин</h1>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {items.map(item => (
            <div key={item.id} className={styles.itemCard}>
              <h2 className={styles.itemName}>{item.name}</h2>
              <p className={styles.itemDescription}>{item.description}</p>
              <p className={styles.itemPrice}>Цена: {item.price} баллов</p>
              <button onClick={() => handlePurchase(item.id)} className={styles.purchaseButton}>
                Купить
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MarketplacePage;
