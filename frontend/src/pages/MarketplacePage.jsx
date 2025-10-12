import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import PageLayout from '../components/PageLayout';
import styles from './MarketplacePage.module.css';
import { FaStar, FaCopy } from 'react-icons/fa';

function MarketplacePage({ user, onPurchaseSuccess }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // --- ИСПРАВЛЕНИЕ №1: Правильно извлекаем функцию showAlert из объекта ---
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getMarketItems();
        setItems(response.data);
      } catch (error) {
        console.error("Failed to fetch market items", error);
        // Добавляем проверку, чтобы избежать ошибок при первой загрузке, когда showAlert еще может быть undefined
        if (showAlert) showAlert("Не удалось загрузить товары. Попробуйте позже.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [showAlert]); // Добавляем showAlert в зависимости, чтобы избежать предупреждений

  // --- ИСПРАВЛЕНИЕ №2: Полностью переписанная, корректная логика покупки ---
  const handlePurchase = async (itemId, itemName, itemPrice) => {
    const isConfirmed = await confirm(`Вы уверены, что хотите купить "${itemName}" за ${itemPrice} спасибок?`);
    if (isConfirmed) {
      try {
        const response = await purchaseItem(user.id, itemId);
        const { new_balance, issued_code } = response.data;
        
        onPurchaseSuccess({ balance: new_balance });

        if (issued_code) {
          showAlert(
            `Поздравляем с покупкой "${itemName}"!`,
            'success',
            <div className={styles.issuedCodeContainer}>
              <p>Ваш уникальный код/ссылка:</p>
              <div className={styles.codeBox}>
                <code>{issued_code}</code>
                <button onClick={() => navigator.clipboard.writeText(issued_code)} className={styles.copyButton}>
                  <FaCopy />
                </button>
              </div>
              <p className={styles.codeNote}>Код также отправлен вам в личные сообщения ботом.</p>
            </div>
          );
        } else {
          showAlert(`Поздравляем! Вы успешно приобрели "${itemName}".`);
        }
        
        const updatedItems = await getMarketItems();
        setItems(updatedItems.data);

      } catch (error) {
        console.error("Purchase failed:", error);
        showAlert(error.response?.data?.detail || "Произошла ошибка при покупке.");
      }
    }
  };

  const activeItems = items.filter(item => !item.is_archived);

  return (
    <PageLayout title="Кафетерий">
      <p className={styles.balance}>Ваш баланс: <strong>{user?.balance}</strong> спасибок</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {activeItems.map(item => {
            const currentPrice = Number(item.price);
            const originalPrice = Number(item.original_price);
            const hasDiscount = typeof item.original_price === 'number' && item.original_price > item.price;
            const discountPercent = hasDiscount ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

            return (
              <div key={item.id} className={styles.itemCard}>
                
                {hasDiscount && (
                  <div className={styles.discountBadge}>
                    <FaStar className={styles.discountIcon} />
                    <span className={styles.discountText}>
                      - {discountPercent}%
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
                  
                  <div className={styles.priceContainer}>
                    <span className={styles.itemPrice}>{currentPrice} спасибок</span>
                    {hasDiscount && (
                      <span className={styles.originalPrice}>
                        {originalPrice}
                      </span>
                    )}
                  </div>

                </div>
                <div className={styles.buttonWrapper}>
                  <button 
                    onClick={() => handlePurchase(item.id, item.name, currentPrice)} 
                    className={styles.purchaseButton}
                    disabled={user?.balance < currentPrice || item.stock <= 0} 
                  >
                    {item.stock > 0 ? 'Купить' : 'Нет в наличии'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}

export default MarketplacePage;
