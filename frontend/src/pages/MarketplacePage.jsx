// frontend/src/pages/MarketplacePage.jsx

import React from 'react';
import { useState, useEffect } from 'react';
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
      <p className={styles.balance}>Ваш баланс: <strong>{user?.balance}</strong> спасибок</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {activeItems.map(item => (
            <div key={item.id} className={styles.itemCard}>
              
              {/* БЛОК ДЛЯ ОТОБРАЖЕНИЯ СКИДКИ (ЗВЕЗДОЧКА) */}
              {item.original_price && item.original_price > item.price && (
                <div className={styles.discountBadge}>
                  <img src="https://i.postimg.cc/MH2V321h/star.png" alt="discount" />
                  <span>
                    - {Math.round(((item.original_price - item.price) / item.original_price) * 100)}%
                  </span>
                </div>
              )}

              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className={styles.itemImage} />
              ) : (
                <div className={styles.imagePlaceholder}></div>
              )}
              
              <div className={styles.itemContent}>
                <h2 className={styles.itemName}>{item.name}</h2>
                <p className={styles.itemDescription}>{item.description}</p>
                
                {/* ИЗМЕНЕННЫЙ БЛОК ЦЕНЫ */}
                <div className={styles.priceContainer}>
                  <span className={styles.itemPrice}>{item.price} спасибок</span>
                  {item.original_price && item.original_price > item.price && (
                    <span className={styles.originalPrice}>
                      {item.original_price}
                    </span>
                  )}
                </div>

              </div>
              <div className={styles.buttonWrapper}>
                <button 
                  onClick={() => handlePurchase(item.id, item.name, item.price)} 
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
} // <--- Вот здесь была лишняя скобка. Теперь она одна, как и положено.

export default MarketplacePage;
