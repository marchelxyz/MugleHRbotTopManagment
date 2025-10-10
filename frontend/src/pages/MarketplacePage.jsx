import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import PageLayout from '../components/PageLayout';
import styles from './MarketplacePage.module.css';
import { FaStar } from 'react-icons/fa';

function MarketplacePage({ user, onPurchaseSuccess }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const showAlert = useModalAlert();
  const confirm = useConfirmation();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getMarketItems();
        setItems(response.data);
        
        // --- "ШПИОНСКАЯ" СТРОКА ---
        console.log("Товары, полученные с сервера (после последнего исправления):", response.data);

      } catch (error) {
        console.error("Failed to fetch market items", error);
        showAlert("Не удалось загрузить товары. Попробуйте позже.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, []);

  const handlePurchase = async (itemId, itemName, itemPrice) => {
    const isConfirmed = await confirm(`Вы уверены, что хотите купить "${itemName}" за ${itemPrice} спасибок?`);
    if (isConfirmed) {
      try {
        const response = await purchaseItem(user.id, itemId);
        onPurchaseSuccess(response.data); 
        showAlert(`Поздравляем! Вы успешно приобрели "${itemName}".`);
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

            // --- ШАГ 2: БОЛЕЕ НАДЕЖНАЯ ПРОВЕРКА ---
            // Преобразуем цены в числа на случай, если они пришли как строки
            const currentPrice = Number(item.price);
            const originalPrice = Number(item.original_price);
          
            // --- 2. ДОБАВЛЯЕМ ПРОВЕРКИ И РАСЧЕТЫ ПЕРЕД ОТРИСОВКОЙ ---
            const hasDiscount = item.original_price && item.original_price > item.price;
            const discountPercent = hasDiscount ? Math.round(((item.original_price - item.price) / item.original_price) * 100) : 0;

  return (
    <PageLayout title="Кафетерий">
      <p className={styles.balance}>Ваш баланс: <strong>{user?.balance}</strong> спасибок</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {activeItems.map(item => {
            const currentPrice = Number(item.price);
            const originalPrice = Number(item.original_price);
            const hasDiscount = originalPrice && originalPrice > currentPrice;
            const discountPercent = hasDiscount ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

            return (
              <div key={item.id} className={styles.itemCard}>
                {hasDiscount && (
                  <div className={styles.discountBadge}>
                    <FaStar className={styles.discountIcon} />
                    <span className={styles.discountText}>- {discountPercent}%</span>
                  </div>
                )}
                {item.image_url ? <img src={item.image_url} alt={item.name} className={styles.itemImage} /> : <div className={styles.imagePlaceholder}></div>}
                <div className={styles.itemContent}>
                  <h2 className={styles.itemName}>{item.name}</h2>
                  <p className={styles.itemDescription}>{item.description}</p>
                  <div className={styles.priceContainer}>
                    <span className={styles.itemPrice}>{currentPrice} спасибок</span>
                    {hasDiscount && <span className={styles.originalPrice}>{originalPrice}</span>}
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
}
export default MarketplacePage;
