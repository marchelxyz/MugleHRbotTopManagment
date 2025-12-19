// frontend/src/components/LocalPurchaseModal.jsx

import React, { useState } from 'react';
import styles from './LocalPurchaseModal.module.css';

function LocalPurchaseModal({ isOpen, onClose, onConfirm, item, user }) {
  const [city, setCity] = useState('');
  const [purchaseUrl, setPurchaseUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!city.trim()) {
      alert('Пожалуйста, введите город');
      return;
    }
    
    if (!purchaseUrl.trim()) {
      alert('Пожалуйста, введите ссылку для покупки');
      return;
    }

    // Простая валидация URL
    try {
      new URL(purchaseUrl);
    } catch {
      alert('Пожалуйста, введите корректную ссылку (начинается с http:// или https://)');
      return;
    }

    setIsSubmitting(true);
    try {
      await onConfirm(city.trim(), purchaseUrl.trim());
      setCity('');
      setPurchaseUrl('');
    } catch (error) {
      console.error('Error creating local purchase:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const availableBalance = user?.balance - (user?.reserved_balance || 0);
  const canAfford = availableBalance >= item?.price;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Локальная покупка</h2>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.content}>
          <div className={styles.itemInfo}>
            <h3 className={styles.itemName}>{item?.name}</h3>
            <p className={styles.itemPrice}>Стоимость: {item?.price} спасибок</p>
            {user?.reserved_balance > 0 && (
              <p className={styles.reservedInfo}>
                Зарезервировано: {user.reserved_balance} спасибок
              </p>
            )}
            <p className={styles.balanceInfo}>
              Доступно: {availableBalance} спасибок
            </p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label htmlFor="city" className={styles.label}>
                Город *
              </label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={styles.input}
                placeholder="Введите город"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="purchaseUrl" className={styles.label}>
                Ссылка для покупки сертификата *
              </label>
              <input
                id="purchaseUrl"
                type="url"
                value={purchaseUrl}
                onChange={(e) => setPurchaseUrl(e.target.value)}
                className={styles.input}
                placeholder="https://example.com/certificate"
                required
                disabled={isSubmitting}
              />
            </div>

            <div className={styles.infoBox}>
              <p className={styles.infoText}>
                💡 После создания запроса спасибки будут зарезервированы и станут недоступны для трат.
                Администратор рассмотрит ваш запрос и примет решение.
              </p>
            </div>

            <div className={styles.actions}>
              <button
                type="button"
                onClick={onClose}
                className={styles.cancelButton}
                disabled={isSubmitting}
              >
                Отмена
              </button>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={isSubmitting || !canAfford}
              >
                {isSubmitting ? 'Отправка...' : 'Создать запрос'}
              </button>
            </div>

            {!canAfford && (
              <p className={styles.errorText}>
                Недостаточно спасибок для покупки
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

export default LocalPurchaseModal;
