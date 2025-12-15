// frontend/src/pages/admin/RegistrationManager.jsx

import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes } from 'react-icons/fa';
import { getPendingUsers, approveUserRegistration, rejectUserRegistration } from '../../api';
import styles from '../AdminPage.module.css';
import registrationStyles from './RegistrationManager.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { formatDateForDisplay } from '../../utils/dateFormatter';

function RegistrationManager() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await getPendingUsers();
      setPendingUsers(response.data);
    } catch (error) {
      showAlert('Не удалось загрузить список заявок', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const handleApprove = async (userId) => {
    const user = pendingUsers.find(u => u.id === userId);
    const isConfirmed = await confirm(
      'Одобрение регистрации',
      `Вы уверены, что хотите одобрить регистрацию пользователя ${user?.first_name} ${user?.last_name}?`
    );
    
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(userId));
    try {
      await approveUserRegistration(userId);
      showAlert('Регистрация одобрена', 'success');
      await loadPendingUsers();
    } catch (error) {
      showAlert(error.response?.data?.detail || 'Не удалось одобрить регистрацию', 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const handleReject = async (userId) => {
    const user = pendingUsers.find(u => u.id === userId);
    const isConfirmed = await confirm(
      'Отклонение регистрации',
      `Вы уверены, что хотите отклонить регистрацию пользователя ${user?.first_name} ${user?.last_name}?`
    );
    
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(userId));
    try {
      await rejectUserRegistration(userId);
      showAlert('Регистрация отклонена', 'success');
      await loadPendingUsers();
    } catch (error) {
      showAlert(error.response?.data?.detail || 'Не удалось отклонить регистрацию', 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  if (loading) {
    return <div className={styles.card}>Загрузка...</div>;
  }

  if (pendingUsers.length === 0) {
    return (
      <div className={styles.card}>
        <h2>Заявки на регистрацию</h2>
        <p>Нет заявок, ожидающих рассмотрения</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2>Заявки на регистрацию ({pendingUsers.length})</h2>
      <div className={registrationStyles.usersList}>
        {pendingUsers.map(user => {
          const isProcessing = processingIds.has(user.id);
          return (
            <div key={user.id} className={registrationStyles.userCard}>
              <div className={registrationStyles.userInfo}>
                <h3>{user.first_name || ''} {user.last_name || ''}</h3>
                <div className={registrationStyles.userDetails}>
                  <p><strong>Должность:</strong> {user.position || 'не указана'}</p>
                  <p><strong>Подразделение:</strong> {user.department || 'не указано'}</p>
                  <p><strong>Телефон:</strong> {user.phone_number || 'не указан'}</p>
                  <p><strong>Дата рождения:</strong> {formatDateForDisplay(user.date_of_birth) || 'не указана'}</p>
                  {user.telegram_id && <p><strong>Telegram ID:</strong> {user.telegram_id}</p>}
                  <p><strong>Дата регистрации:</strong> {formatDateForDisplay(user.registration_date) || 'не указана'}</p>
                </div>
              </div>
              <div className={registrationStyles.actions}>
                <button
                  onClick={() => handleApprove(user.id)}
                  disabled={isProcessing}
                  className={registrationStyles.approveButton}
                  title="Одобрить"
                >
                  <FaCheck /> Одобрить
                </button>
                <button
                  onClick={() => handleReject(user.id)}
                  disabled={isProcessing}
                  className={registrationStyles.rejectButton}
                  title="Отклонить"
                >
                  <FaTimes /> Отклонить
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default RegistrationManager;
