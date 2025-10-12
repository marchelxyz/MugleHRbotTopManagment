import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import PageLayout from '../components/PageLayout';
import styles from './MarketplacePage.module.css';
import PurchaseSuccessModal from '../components/PurchaseSuccessModal';
import { FaStar, FaCopy } from 'react-icons/fa';

function MarketplacePage({ user, onPurchaseSuccess }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseSuccessData, setPurchaseSuccessData] = useState(null); // <-- ДОБАВЬ ЭТО
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
  const handlePurchase = async (item) => {
    const isConfirmed = await confirm(`Вы уверены, что хотите купить "${item.name}" за ${item.price} спасибок?`);
    if (isConfirmed) {
      try {
        const response = await purchaseItem(user.telegram_id, item.id);
        const { new_balance, issued_code } = response.data;
        
        onPurchaseSuccess({ balance: new_balance });

        // Сохраняем данные для модального окна, включая полученный код
        setPurchaseSuccessData({ ...item, issued_code });
        
        // Обновляем список товаров, чтобы показать актуальный сток
        const updatedItems = await getMarketItems();
        setItems(updatedItems.data);

      } catch (error) {
        console.error("Purchase failed:", error);
        showAlert(error.response?.data?.detail || "Произошла ошибка при покупке.", 'error');
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
                    onClick={() => handlePurchase(item)}
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
            {purchaseSuccessData && (
        <PurchaseSuccessModal
          item={purchaseSuccessData}
          onClose={() => setPurchaseSuccessData(null)}
        />
      )}
    </PageLayout>
  );
}
      )}
    </PageLayout>
  );
}

export default MarketplacePage;
