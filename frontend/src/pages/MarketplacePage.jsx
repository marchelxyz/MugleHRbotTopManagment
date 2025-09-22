// frontend/src/pages/MarketplacePage.jsx

import React from 'react';
import { useState, useEffect } from 'react';
// 1. Импортируем API_BASE_URL вместе с остальными функциями
import { getMarketItems, purchaseItem } from '../api';
import styles from './MarketplacePage.module.css';
import PageLayout from '../components/PageLayout';
import { getCachedData } from '../storage';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';

function MarketplacePage({ user, onPurchaseSuccess }) {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [items, setItems] = useState(() => getCachedData('market'));
  const [isLoading, setIsLoading] = useState(!items); 
  
  useEffect(() => {
    if (!items) {
      const fetchItems = async () => {
        try {
          const response = await getMarketItems();
          setItems(response.data);
        } catch (error) { 
          console.error("Failed to fetch market items", error);
          showAlert('Не удалось загрузить товары.', 'error');
        } finally { 
          setIsLoading(false); 
        }
      };
      fetchItems();
    }
  }, [items, showAlert]);

  const handlePurchase = async (itemId) => {
    if (!user) {
      showAlert("Не удалось определить пользователя. Пожалуйста, перезапустите приложение.", 'error');
      return;
    }

    const isConfirmed = await confirm("Подтверждение покупки", "Вы уверены, что хотите купить этот товар?");
    if (!isConfirmed) return;
    
    try {
      const response = await purchaseItem(user.id, itemId);
      onPurchaseSuccess({ balance: response.data.new_balance });
      showAlert(`Покупка совершена! Детали отправлены вам в чат с ботом.`, 'success');
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'Не удалось совершить покупку.';
      showAlert(errorMessage, 'error');
    }
  };
  
  return (
    <PageLayout title="Кафетерий">
      <p>Ваш баланс: <strong>{user?.balance}</strong> спасибок</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {items.map(item => (
            <div key={item.id} className={styles.itemCard}>
              {/* 2. Используем image_url НАПРЯМУЮ */}
              {item.image_url && (
                <img src={item.image_url} alt={item.name} className={styles.itemImage} />
              )}
              <div className={styles.itemContent}>
                <h2 className={styles.itemName}>{item.name}</h2>
                <p className={styles.itemDescription}>{item.description}</p>
                <p className={styles.itemPrice}>Цена: {item.price} спасибок ({item.price_rub} ₽)</p>
              </div>
              <div className={styles.buttonWrapper}>
                <button 
                  onClick={() => handlePurchase(item.id)} 
                  className={styles.purchaseButton}
                  disabled={user?.balance < item.price || item.stock <= 0} 
                >
                  {item.stock > 0 ? 'Купить' : 'Нет в наличии'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  );
}

export default MarketplacePage;
