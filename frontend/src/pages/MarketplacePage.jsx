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

  const handlePurchase = async (itemId) => {
    if (!user) {
      alert("Не удалось определить пользователя. Пожалуйста, перезапустите приложение.");
      return;
    }
    if (!window.confirm("Вы уверены, что хотите купить этот товар?")) return;
    
    try {
      // 2. Вызываем обновленную функцию с user.id
      await purchaseItem(user.id, itemId);
      alert(`Покупка совершена успешно!`);
      // TODO: Обновить баланс пользователя в реальном времени
      window.location.reload(); // Временно перезагружаем страницу для обновления баланса
    } catch (error) {
      // 3. Улучшенная обработка ошибок
      let errorMessage = 'Не удалось совершить покупку.';
      if (error.response && error.response.data && error.response.data.detail) {
        // Если ошибка - это текст (как мы ожидаем)
        if (typeof error.response.data.detail === 'string') {
          errorMessage = error.response.data.detail;
        } else {
          // Если ошибка - сложный объект (например, ошибка валидации)
          errorMessage = JSON.stringify(error.response.data.detail);
        }
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
