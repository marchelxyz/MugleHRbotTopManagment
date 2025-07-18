// frontend/src/pages/MarketplacePage.jsx
import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';

const tg = window.Telegram.WebApp;
const currentUserId = tg.initDataUnsafe?.user?.id;

function MarketplacePage() {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ... (код для загрузки товаров)
  }, []);

  const handlePurchase = async (itemId) => {
    if (!window.confirm("Вы уверены, что хотите купить этот товар?")) return;
    try {
      const response = await purchaseItem(currentUserId, itemId);
      alert(`Покупка совершена успешно! Ваш новый баланс: ${response.data.new_balance} баллов.`);
      // Обновляем список товаров (например, если товар закончился)
      // ...
    } catch (error) {
      alert(`Ошибка: ${error.response?.data?.detail || 'Не удалось совершить покупку.'}`);
    }
  };
  
  return (
    <div>
      <h1>Магазин</h1>
      {/* ... (здесь будет код для отображения товаров в виде карточек) ... */}
      {items.map(item => (
        <div key={item.id}>
          <h2>{item.name}</h2>
          <p>{item.description}</p>
          <p>Цена: {item.price} баллов</p>
          <button onClick={() => handlePurchase(item.id)}>Купить</button>
        </div>
      ))}
    </div>
  );
}

export default MarketplacePage;
