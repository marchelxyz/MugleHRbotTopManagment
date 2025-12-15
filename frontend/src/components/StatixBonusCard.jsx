import React, { useState, useEffect } from 'react';
import { purchaseStatixBonus, getStatixBonusItem, refreshCardBalance } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import styles from './StatixBonusCard.module.css';

function StatixBonusCard({ user, onPurchaseSuccess }) {
  const [statixItem, setStatixItem] = useState(null);
  const [bonusAmount, setBonusAmount] = useState(100);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();

  useEffect(() => {
    const fetchStatixItem = async () => {
      try {
        const response = await getStatixBonusItem();
        setStatixItem(response.data);
        setBonusAmount(response.data.min_bonus_per_step);
      } catch (error) {
        console.error("Failed to fetch Statix Bonus item", error);
        showAlert("Не удалось загрузить настройки бонусов Statix.", 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStatixItem();
  }, [showAlert]);

  const handleSliderChange = (event) => {
    const value = parseInt(event.target.value);
    setBonusAmount(value);
  };

  const calculateThanksCost = () => {
    if (!statixItem) return 0;
    return Math.round((bonusAmount / 100) * statixItem.thanks_to_statix_rate);
  };

  const handlePurchase = async () => {
    if (!statixItem) return;
    
    const thanksCost = calculateThanksCost();
    const isConfirmed = await confirm(
      `Вы уверены, что хотите купить ${bonusAmount} бонусов Statix за ${thanksCost} спасибок?`
    );
    
    if (isConfirmed) {
      setIsPurchasing(true);
      try {
        const response = await purchaseStatixBonus(user.telegram_id, bonusAmount);
        const { new_balance, purchased_bonus_amount } = response.data;
        
        // Обновляем баланс спасибок
        onPurchaseSuccess({ balance: new_balance });
        
        // Пытаемся обновить баланс карты после покупки бонусов
        try {
          const cardBalanceResponse = await refreshCardBalance();
          if (cardBalanceResponse?.data) {
            onPurchaseSuccess({ 
              balance: new_balance,
              card_balance: cardBalanceResponse.data.card_balance 
            });
          }
        } catch (cardError) {
          // Не критично, если не удалось обновить баланс карты
          console.warn("Не удалось обновить баланс карты после покупки:", cardError);
        }
        
        // Показываем модальное окно с результатом покупки
        showAlert(
          `Успешно приобретено ${purchased_bonus_amount} бонусов Statix!`,
          'success'
        );
        
        // Сбрасываем ползунок к минимальному значению
        setBonusAmount(statixItem.min_bonus_per_step);
        
      } catch (error) {
        console.error("Statix Bonus purchase failed:", error);
        showAlert(error.response?.data?.detail || "Произошла ошибка при покупке бонусов.", 'error');
      } finally {
        setIsPurchasing(false);
      }
    }
  };

  if (isLoading) {
    return (
      <div className={styles.card}>
        <div className={styles.loading}>Загрузка...</div>
      </div>
    );
  }

  if (!statixItem || !statixItem.is_active) {
    return null;
  }

  const thanksCost = calculateThanksCost();
  const canAfford = user?.balance >= thanksCost;
  const hasCard = user?.card_barcode; // Проверяем наличие карты статикс

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h2 className={styles.title}>{statixItem.name}</h2>
        <p className={styles.description}>{statixItem.description}</p>
      </div>

      {statixItem.image_url && (
        <div className={styles.imageContainer}>
          <img 
            src={statixItem.image_url} 
            alt={statixItem.name} 
            className={styles.image}
            loading="lazy"
          />
        </div>
      )}

      {!hasCard && (
        <div className={styles.noCardWarning}>
          ⚠️ Для покупки бонусов необходимо добавить карту статикс в профиль
        </div>
      )}

      <div className={styles.bonusSelector}>
        <div className={styles.amountDisplay}>
          <span className={styles.bonusAmount}>{bonusAmount}</span>
          <span className={styles.bonusLabel}>бонусов Statix</span>
        </div>
        
        <div className={styles.sliderContainer}>
          <input
            type="range"
            min={statixItem.min_bonus_per_step}
            max={statixItem.max_bonus_per_step}
            step={statixItem.bonus_step}
            value={bonusAmount}
            onChange={handleSliderChange}
            className={styles.slider}
            disabled={isPurchasing}
          />
          <div className={styles.sliderLabels}>
            <span>{statixItem.min_bonus_per_step}</span>
            <span>{statixItem.max_bonus_per_step}</span>
          </div>
        </div>
      </div>

      <div className={styles.priceInfo}>
        <div className={styles.priceRow}>
          <span>Стоимость:</span>
          <span className={styles.price}>{thanksCost} спасибок</span>
        </div>
        <div className={styles.rateInfo}>
          Курс: {statixItem.thanks_to_statix_rate} спасибок за 100 бонусов
        </div>
      </div>

      <button
        onClick={handlePurchase}
        disabled={!canAfford || !hasCard || isPurchasing}
        className={`${styles.purchaseButton} ${(!canAfford || !hasCard) ? styles.disabled : ''}`}
      >
        {isPurchasing ? 'Покупка...' : 'Купить бонусы'}
      </button>

      {!canAfford && (
        <div className={styles.insufficientFunds}>
          Недостаточно спасибок для покупки
        </div>
      )}
    </div>
  );
}

export default StatixBonusCard;