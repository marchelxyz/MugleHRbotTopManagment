import React, { useState, useEffect, useCallback } from 'react';
import styles from './PurchasesManager.module.css';
import { getAllPurchases, approveLocalPurchase, rejectLocalPurchase } from '../../api';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { FaCheckCircle, FaTimesCircle, FaGift, FaSpinner, FaChevronLeft, FaChevronRight } from 'react-icons/fa';

const STATUS_TABS = [
  { key: null, label: 'Все' },
  { key: 'pending', label: 'На согласовании' },
  { key: 'completed', label: 'Завершённые' },
  { key: 'approved', label: 'Одобренные' },
  { key: 'rejected', label: 'Отклонённые' },
  { key: 'expired', label: 'Истёкшие' },
];

const TYPE_FILTERS = [
  { key: null, label: 'Все типы' },
  { key: 'regular', label: 'Обычные' },
  { key: 'local', label: 'Локальные' },
  { key: 'statix', label: 'Statix' },
  { key: 'shared', label: 'Совместные' },
];

const TYPE_LABELS = {
  regular: 'Обычная',
  local: 'Локальная',
  statix: 'Statix',
  shared: 'Совместная',
};

const STATUS_COLORS = {
  pending: '#f39c12',
  completed: '#27ae60',
  approved: '#27ae60',
  rejected: '#e74c3c',
  expired: '#95a5a6',
  accepted: '#27ae60',
};

function PurchasesManager() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();

  const [purchases, setPurchases] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [statusTab, setStatusTab] = useState(null);
  const [typeFilter, setTypeFilter] = useState(null);
  const [page, setPage] = useState(1);
  const perPage = 30;

  const loadPurchases = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getAllPurchases(typeFilter, statusTab, page, perPage);
      setPurchases(response.data.items || []);
      setTotal(response.data.total || 0);
    } catch (error) {
      showAlert('Не удалось загрузить список покупок', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [statusTab, typeFilter, page]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    setPage(1);
  }, [statusTab, typeFilter]);

  const handleApprove = async (purchaseId) => {
    const isConfirmed = await confirm('Подтверждение', 'Одобрить эту покупку?');
    if (!isConfirmed) return;
    setProcessingIds(prev => new Set(prev).add(purchaseId));
    try {
      await approveLocalPurchase(purchaseId);
      showAlert('Покупка одобрена', 'success');
      await loadPurchases();
    } catch (error) {
      showAlert(error.response?.data?.detail || 'Не удалось одобрить покупку', 'error');
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(purchaseId); return s; });
    }
  };

  const handleReject = async (purchaseId) => {
    const isConfirmed = await confirm('Подтверждение', 'Отклонить покупку? Спасибки вернутся пользователю.');
    if (!isConfirmed) return;
    setProcessingIds(prev => new Set(prev).add(purchaseId));
    try {
      await rejectLocalPurchase(purchaseId);
      showAlert('Покупка отклонена', 'success');
      await loadPurchases();
    } catch (error) {
      showAlert(error.response?.data?.detail || 'Не удалось отклонить покупку', 'error');
    } finally {
      setProcessingIds(prev => { const s = new Set(prev); s.delete(purchaseId); return s; });
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className={styles.container}>
      <h2>Все покупки</h2>

      <div className={styles.tabsRow}>
        {STATUS_TABS.map(tab => (
          <button
            key={tab.key || 'all'}
            className={`${styles.tabButton} ${statusTab === tab.key ? styles.tabActive : ''}`}
            onClick={() => setStatusTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className={styles.filtersRow}>
        {TYPE_FILTERS.map(f => (
          <button
            key={f.key || 'all'}
            className={`${styles.filterChip} ${typeFilter === f.key ? styles.filterActive : ''}`}
            onClick={() => setTypeFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.loading}>
          <FaSpinner className={styles.spinner} />
          <p>Загрузка...</p>
        </div>
      ) : purchases.length === 0 ? (
        <div className={styles.empty}>
          <FaGift className={styles.emptyIcon} />
          <p>Нет покупок</p>
        </div>
      ) : (
        <>
          <p className={styles.totalLabel}>Найдено: {total}</p>
          <div className={styles.purchasesList}>
            {purchases.map(purchase => {
              const isProcessing = processingIds.has(purchase.id);
              const canApprove = purchase.purchase_type === 'local' && purchase.status === 'pending';
              return (
                <div key={`${purchase.purchase_type}-${purchase.id}`} className={styles.purchaseCard}>
                  <div className={styles.purchaseHeader}>
                    <div style={{ flex: 1 }}>
                      <h3>{purchase.item_name}</h3>
                      <div className={styles.badges}>
                        <span className={styles.typeBadge}>
                          {TYPE_LABELS[purchase.purchase_type] || purchase.purchase_type}
                        </span>
                        <span
                          className={styles.statusBadge}
                          style={{ background: STATUS_COLORS[purchase.status] || '#999' }}
                        >
                          {purchase.status}
                        </span>
                      </div>
                    </div>
                    <span className={styles.purchaseDate}>{formatDate(purchase.created_at)}</span>
                  </div>
                  <div className={styles.purchaseInfo}>
                    <p><strong>Пользователь:</strong> {purchase.user_name}</p>
                    <p><strong>Сумма:</strong> {purchase.amount} спасибок</p>
                    {purchase.city && <p><strong>Город:</strong> {purchase.city}</p>}
                    {purchase.website_url && (
                      <p>
                        <strong>Сайт:</strong>{' '}
                        <a href={purchase.website_url} target="_blank" rel="noopener noreferrer">
                          {purchase.website_url}
                        </a>
                      </p>
                    )}
                  </div>
                  {canApprove && (
                    <div className={styles.purchaseActions}>
                      <button onClick={() => handleApprove(purchase.id)} disabled={isProcessing} className={styles.approveButton}>
                        {isProcessing ? <FaSpinner className={styles.spinner} /> : <FaCheckCircle />}
                        Одобрить
                      </button>
                      <button onClick={() => handleReject(purchase.id)} disabled={isProcessing} className={styles.rejectButton}>
                        {isProcessing ? <FaSpinner className={styles.spinner} /> : <FaTimesCircle />}
                        Отклонить
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className={styles.pagination}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className={styles.pageButton}>
                <FaChevronLeft />
              </button>
              <span className={styles.pageInfo}>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className={styles.pageButton}>
                <FaChevronRight />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default PurchasesManager;
