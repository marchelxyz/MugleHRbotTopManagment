// frontend/src/pages/MarketplacePage.jsx
import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import styles from './MarketplacePage.module.css';

// 1. Принимаем новую функцию onPurchaseSuccess в пропсах
function MarketplacePage({ user, onPurchaseSuccess }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
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

// frontend/src/pages/MarketplacePage.jsx

  const handlePurchase = async (itemId) => {
    if (!user) {
      alert("Не удалось определить пользователя. Пожалуйста, перезапустите приложение.");
      return;
    }
    // Можно оставить confirm для подтверждения
    if (!window.confirm("Вы уверены, что хотите купить этот товар?")) return;
    
    try {
      const response = await purchaseItem(user.id, itemId);
      
      // --- НАЧАЛО ИЗМЕНЕНИЙ ---
      // 2. Обновляем баланс пользователя в главном компоненте
      onPurchaseSuccess({ balance: response.data.new_balance });

      // 3. Показываем более приятное сообщение
      alert(`Покупка совершена! Детали отправлены вам в чат с ботом.`);
      
      // Перезагрузка больше не нужна, так как баланс обновился
      // window.location.reload();
} catch (error) {
      let errorMessage = 'Не удалось совершить покупку.';
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      }
      alert(`Ошибка: ${errorMessage}`);
    }
  };
  
  return (
    <div className={styles.page}>
      <h1>🛒 Магазин</h1>
      <p>Ваш баланс: <strong>{user?.balance}</strong> баллов</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {items.map(item => (
            <div key={item.id} className={styles.itemCard}>
              <h2 className={styles.itemName}>{item.name}</h2>
              <p className={styles.itemDescription}>{item.description}</p>
              <p className={styles.itemPrice}>Цена: {item.price} баллов</p>
              <button 
                onClick={() => handlePurchase(item.id)} 
                className={styles.purchaseButton}
                // Не даем купить, если не хватает баллов
                disabled={user?.balance < item.price} 
              >
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
