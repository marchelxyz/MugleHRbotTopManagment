// frontend/src/pages/MarketplacePage.jsx
import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import styles from './MarketplacePage.module.css';

// 1. Принимаем полного 'user' в пропсах
function MarketplacePage({ user }) {
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
    if (!window.confirm("Вы уверены, что хотите купить этот товар?")) return;
    
    try {
      const response = await purchaseItem(user.id, itemId);
      // --- ИЗМЕНЕНИЕ: Показываем сообщение с новым балансом ---
      alert(`Покупка совершена успешно! Ваш новый баланс: ${response.data.new_balance} баллов.`);
      window.location.reload(); // Перезагружаем для обновления всего состояния
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
