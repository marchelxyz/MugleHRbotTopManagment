// frontend/src/pages/admin/PurchasesManager.jsx

import React, { useState, useEffect } from 'react';
import styles from './PurchasesManager.module.css';
import { getPendingLocalPurchases, approveLocalPurchase, rejectLocalPurchase } from '../../api';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { FaCheckCircle, FaTimesCircle, FaGift, FaSpinner } from 'react-icons/fa';

function PurchasesManager() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    try {
      setLoading(true);
      const response = await getPendingLocalPurchases();
      setPurchases(response.data);
    } catch (error) {
      showAlert('Не удалось загрузить список покупок', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (purchaseId) => {
    const isConfirmed = await confirm(
      'Подтверждение',
      'Вы уверены, что хотите одобрить эту покупку?'
    );
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(purchaseId));
    try {
      await approveLocalPurchase(purchaseId);
      showAlert('Покупка одобрена', 'success');
      await loadPurchases();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось одобрить покупку';
      showAlert(errorMsg, 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(purchaseId);
        return newSet;
      });
    }
  };

  const handleReject = async (purchaseId) => {
    const isConfirmed = await confirm(
      'Подтверждение',
      'Вы уверены, что хотите отклонить эту покупку? Спасибки будут возвращены пользователю.'
    );
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(purchaseId));
    try {
      await rejectLocalPurchase(purchaseId);
      showAlert('Покупка отклонена', 'success');
      await loadPurchases();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось отклонить покупку';
      showAlert(errorMsg, 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(purchaseId);
        return newSet;
      });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <FaSpinner className={styles.spinner} />
        <p>Загрузка...</p>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className={styles.empty}>
        <FaGift className={styles.emptyIcon} />
        <p>Нет покупок, ожидающих согласования</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2>Покупки, ожидающие согласования</h2>
      <div className={styles.purchasesList}>
        {purchases.map(purchase => {
          const isProcessing = processingIds.has(purchase.id);
          return (
            <div key={purchase.id} className={styles.purchaseCard}>
              <div className={styles.purchaseHeader}>
                <h3>{purchase.item_name}</h3>
                <span className={styles.purchaseDate}>{formatDate(purchase.created_at)}</span>
              </div>
              <div className={styles.purchaseInfo}>
                <p><strong>Пользователь:</strong> {purchase.user_name}</p>
                <p><strong>Город:</strong> {purchase.city}</p>
                <p><strong>Сайт:</strong> <a href={purchase.website_url} target="_blank" rel="noopener noreferrer">{purchase.website_url}</a></p>
                <p><strong>Сумма:</strong> {purchase.reserved_amount} спасибок</p>
              </div>
              <div className={styles.purchaseActions}>
                <button
                  onClick={() => handleApprove(purchase.id)}
                  disabled={isProcessing}
                  className={styles.approveButton}
                >
                  {isProcessing ? <FaSpinner className={styles.spinner} /> : <FaCheckCircle />}
                  Одобрить
                </button>
                <button
                  onClick={() => handleReject(purchase.id)}
                  disabled={isProcessing}
                  className={styles.rejectButton}
                >
                  {isProcessing ? <FaSpinner className={styles.spinner} /> : <FaTimesCircle />}
                  Отклонить
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PurchasesManager;
