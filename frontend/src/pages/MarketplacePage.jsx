// frontend/src/pages/MarketplacePage.jsx
import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem, API_BASE_URL } from '../api';
import styles from './MarketplacePage.module.css';
import PageLayout from '../components/PageLayout';
import { useModalAlert } from '../contexts/ModalAlertContext'; // 1. Импортируем
import { getCachedData } from '../storage';

// 1. Принимаем новую функцию onPurchaseSuccess в пропсах
function MarketplacePage({ user, onPurchaseSuccess }) {
  const { showAlert } = useModalAlert(); // 2. Получаем функцию
  // --- 2. ИЗМЕНЯЕМ ИНИЦИАЛИЗАЦИЮ СОСТОЯНИЯ ---
  const [items, setItems] = useState(() => getCachedData('market'));
  const [isLoading, setIsLoading] = useState(!items); 
  
  useEffect(() => {
    // Если данные не были в кэше, загружаем их
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
    <PageLayout title="Кафетерий">
      <p>Ваш баланс: <strong>{user?.balance}</strong> баллов</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {items.map(item => (
            <div key={item.id} className={styles.itemCard}>
              {/* --- 2. СТРОИМ ПОЛНУЮ ССЫЛКУ НА ИЗОБРАЖЕНИЕ --- */}
              {item.image_url && (
                <img src={`${API_BASE_URL}${item.image_url}`} alt={item.name} className={styles.itemImage} />
              )}
              <h2 className={styles.itemName}>{item.name}</h2>
              <p className={styles.itemDescription}>{item.description}</p>
              <p className={styles.itemPrice}>Цена: {item.price} баллов</p>
              <button onClick={() => handlePurchase(item.id)} /* ... */ >Купить</button>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

export default MarketplacePage;
