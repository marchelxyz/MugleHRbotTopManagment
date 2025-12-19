// frontend/src/pages/admin/ApprovalsManager.jsx

import React, { useState, useEffect } from 'react';
import styles from './ApprovalsManager.module.css';
import { getPendingProfileUpdates, approveProfileUpdate, rejectProfileUpdate } from '../../api';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { FaCheckCircle, FaTimesCircle, FaUserEdit, FaSpinner } from 'react-icons/fa';

function ApprovalsManager() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    loadUpdates();
  }, []);

  const loadUpdates = async () => {
    try {
      setLoading(true);
      const response = await getPendingProfileUpdates();
      setUpdates(response.data);
    } catch (error) {
      showAlert('Не удалось загрузить список запросов', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (updateId) => {
    const isConfirmed = await confirm(
      'Подтверждение',
      'Вы уверены, что хотите одобрить эти изменения профиля?'
    );
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(updateId));
    try {
      await approveProfileUpdate(updateId);
      showAlert('Изменения профиля одобрены', 'success');
      await loadUpdates();
      setExpandedId(null);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось одобрить изменения';
      showAlert(errorMsg, 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateId);
        return newSet;
      });
    }
  };

  const handleReject = async (updateId) => {
    const isConfirmed = await confirm(
      'Подтверждение',
      'Вы уверены, что хотите отклонить эти изменения профиля?'
    );
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(updateId));
    try {
      await rejectProfileUpdate(updateId);
      showAlert('Изменения профиля отклонены', 'success');
      await loadUpdates();
      setExpandedId(null);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось отклонить изменения';
      showAlert(errorMsg, 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(updateId);
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

  const formatFieldName = (fieldName) => {
    const names = {
      'last_name': 'Фамилия',
      'department': 'Подразделение',
      'position': 'Должность',
      'phone_number': 'Телефон',
      'date_of_birth': 'Дата рождения'
    };
    return names[fieldName] || fieldName;
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <FaSpinner className={styles.spinner} />
        <p>Загрузка...</p>
      </div>
    );
  }

  if (updates.length === 0) {
    return (
      <div className={styles.empty}>
        <FaUserEdit className={styles.emptyIcon} />
        <p>Нет запросов на изменение профиля</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h2>Запросы на изменение профиля</h2>
      <div className={styles.updatesList}>
        {updates.map(update => {
          const isProcessing = processingIds.has(update.id);
          const isExpanded = expandedId === update.id;
          const changedFields = Object.keys(update.new_data || {});
          
          return (
            <div key={update.id} className={styles.updateCard}>
              <div className={styles.updateHeader}>
                <div>
                  <h3>{update.user_name}</h3>
                  <span className={styles.updateDate}>{formatDate(update.created_at)}</span>
                </div>
                <button
                  onClick={() => setExpandedId(isExpanded ? null : update.id)}
                  className={styles.expandButton}
                >
                  {isExpanded ? 'Свернуть' : 'Подробнее'}
                </button>
              </div>
              
              {isExpanded && (
                <div className={styles.updateDetails}>
                  <h4>Изменения:</h4>
                  {changedFields.map(field => (
                    <div key={field} className={styles.fieldChange}>
                      <strong>{formatFieldName(field)}:</strong>
                      <div className={styles.changeRow}>
                        <span className={styles.oldValue}>
                          Старое: {update.old_data[field] || 'не указано'}
                        </span>
                        <span className={styles.arrow}>→</span>
                        <span className={styles.newValue}>
                          Новое: {update.new_data[field] || 'не указано'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className={styles.updateActions}>
                <button
                  onClick={() => handleApprove(update.id)}
                  disabled={isProcessing}
                  className={styles.approveButton}
                >
                  {isProcessing ? <FaSpinner className={styles.spinner} /> : <FaCheckCircle />}
                  Одобрить
                </button>
                <button
                  onClick={() => handleReject(update.id)}
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

export default ApprovalsManager;
