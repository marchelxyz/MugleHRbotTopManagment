// frontend/src/pages/admin/LocalPurchaseManager.jsx

import React, { useState, useEffect } from 'react';
import { getLocalPurchases, approveLocalPurchase, rejectLocalPurchase } from '../../api';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import styles from './LocalPurchaseManager.module.css';

function LocalPurchaseManager() {
  const [purchases, setPurchases] = useState([]);
  const [filter, setFilter] = useState('pending'); // 'pending', 'approved', 'rejected', 'all'
  const [isLoading, setIsLoading] = useState(true);
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();

  useEffect(() => {
    fetchPurchases();
  }, [filter]);

  const fetchPurchases = async () => {
    setIsLoading(true);
    try {
      const status = filter === 'all' ? null : filter;
      const response = await getLocalPurchases(status);
      setPurchases(response.data);
    } catch (error) {
      console.error('Failed to fetch local purchases:', error);
      showAlert('Не удалось загрузить локальные покупки', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (purchaseId) => {
    const isConfirmed = await confirm(
      'Подтверждение',
      'Вы уверены, что хотите одобрить эту покупку? Спасибки будут списаны с баланса пользователя.'
    );
    
    if (!isConfirmed) return;

    try {
      await approveLocalPurchase(purchaseId);
      showAlert('Покупка одобрена', 'success');
      fetchPurchases();
    } catch (error) {
      console.error('Failed to approve purchase:', error);
      showAlert(error.response?.data?.detail || 'Ошибка при одобрении покупки', 'error');
    }
  };

  const handleReject = async (purchaseId) => {
    const isConfirmed = await confirm(
      'Подтверждение',
      'Вы уверены, что хотите отклонить эту покупку? Зарезервированные спасибки будут возвращены пользователю.'
    );
    
    if (!isConfirmed) return;

    try {
      await rejectLocalPurchase(purchaseId);
      showAlert('Покупка отклонена', 'success');
      fetchPurchases();
    } catch (error) {
      console.error('Failed to reject purchase:', error);
      showAlert(error.response?.data?.detail || 'Ошибка при отклонении покупки', 'error');
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'pending': return styles.statusPending;
      case 'approved': return styles.statusApproved;
      case 'rejected': return styles.statusRejected;
      default: return '';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending': return 'Ожидает';
      case 'approved': return 'Одобрено';
      case 'rejected': return 'Отклонено';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (isLoading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2>Управление локальными покупками</h2>
        <div className={styles.filters}>
          <button
            className={filter === 'all' ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter('all')}
          >
            Все
          </button>
          <button
            className={filter === 'pending' ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter('pending')}
          >
            Ожидают
          </button>
          <button
            className={filter === 'approved' ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter('approved')}
          >
            Одобрены
          </button>
          <button
            className={filter === 'rejected' ? styles.filterActive : styles.filterButton}
            onClick={() => setFilter('rejected')}
          >
            Отклонены
          </button>
        </div>
      </div>

      {purchases.length === 0 ? (
        <div className={styles.emptyState}>
          Нет покупок с выбранным статусом
        </div>
      ) : (
        <div className={styles.purchasesList}>
          {purchases.map((purchase) => (
            <div key={purchase.id} className={styles.purchaseCard}>
              <div className={styles.purchaseHeader}>
                <div className={styles.purchaseInfo}>
                  <h3 className={styles.itemName}>{purchase.item?.name}</h3>
                  <span className={`${styles.statusBadge} ${getStatusBadgeClass(purchase.status)}`}>
                    {getStatusLabel(purchase.status)}
                  </span>
                </div>
                <div className={styles.purchaseId}>ID: #{purchase.id}</div>
              </div>

              <div className={styles.purchaseDetails}>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Пользователь:</span>
                  <span className={styles.detailValue}>
                    {purchase.user?.first_name} {purchase.user?.last_name}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Telegram:</span>
                  <span className={styles.detailValue}>
                    @{purchase.user?.username || purchase.user?.telegram_id}
                  </span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Должность:</span>
                  <span className={styles.detailValue}>{purchase.user?.position}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Подразделение:</span>
                  <span className={styles.detailValue}>{purchase.user?.department}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Город:</span>
                  <span className={styles.detailValue}>{purchase.city}</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Ссылка:</span>
                  <a
                    href={purchase.purchase_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                  >
                    {purchase.purchase_url}
                  </a>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Стоимость:</span>
                  <span className={styles.detailValue}>{purchase.item?.price} спасибок</span>
                </div>
                <div className={styles.detailRow}>
                  <span className={styles.detailLabel}>Создано:</span>
                  <span className={styles.detailValue}>{formatDate(purchase.created_at)}</span>
                </div>
                {purchase.approved_at && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Одобрено:</span>
                    <span className={styles.detailValue}>{formatDate(purchase.approved_at)}</span>
                  </div>
                )}
                {purchase.rejected_at && (
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Отклонено:</span>
                    <span className={styles.detailValue}>{formatDate(purchase.rejected_at)}</span>
                  </div>
                )}
              </div>

              {purchase.status === 'pending' && (
                <div className={styles.actions}>
                  <button
                    className={styles.approveButton}
                    onClick={() => handleApprove(purchase.id)}
                  >
                    ✅ Одобрить
                  </button>
                  <button
                    className={styles.rejectButton}
                    onClick={() => handleReject(purchase.id)}
                  >
                    ❌ Отклонить
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LocalPurchaseManager;
