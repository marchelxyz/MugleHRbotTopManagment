// frontend/src/pages/MarketplacePage.jsx

import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import PageLayout from '../components/PageLayout';
import StatixBonusCard from '../components/StatixBonusCard';
import styles from './MarketplacePage.module.css';
import { FaStar, FaCopy } from 'react-icons/fa';
import PurchaseSuccessModal from '../components/PurchaseSuccessModal';

function MarketplacePage({ user, onPurchaseSuccess }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [purchaseSuccessData, setPurchaseSuccessData] = useState(null);
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getMarketItems();
        setItems(response.data);
      } catch (error) {
        console.error("Failed to fetch market items", error);
        showAlert("Не удалось загрузить товары. Попробуйте позже.", 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [showAlert]);

  const handlePurchase = async (item) => {
    const isConfirmed = await confirm(`Вы уверены, что хотите купить "${item.name}" за ${item.price} спасибок?`);
    if (isConfirmed) {
      try {
        const response = await purchaseItem(user.telegram_id, item.id);
        const { new_balance, issued_code } = response.data;
        
        onPurchaseSuccess({ balance: new_balance });

        setPurchaseSuccessData({ ...item, issued_code });
        
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
      
      {/* Statix Bonus Card - показываем первым */}
      <StatixBonusCard user={user} onPurchaseSuccess={onPurchaseSuccess} />
      
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
      )}

      {purchaseSuccessData && (
        <PurchaseSuccessModal
          item={purchaseSuccessData}
          onClose={() => setPurchaseSuccessData(null)}
        />
      )}
    </PageLayout>
  );
}

export default MarketplacePage;
