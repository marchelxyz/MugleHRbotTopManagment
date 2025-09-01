// frontend/src/pages/TransferPage.jsx

import React, { useState, useEffect } from 'react';
import { getAllUsers, transferPoints } from '../api';
import styles from './TransferPage.module.css';
import PageLayout from '../components/PageLayout';

function TransferPage({ user, onBack, onTransferSuccess }) {
  const [users, setUsers] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  // --- ИЗМЕНЕНИЕ: Убираем состояние для суммы ---
  // const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentUserId = user?.id;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getAllUsers();
        setUsers(response.data.filter(u => u.id !== currentUserId));
      } catch (error) {
        setError('Не удалось загрузить список сотрудников.');
      }
    };
    if (currentUserId) {
      fetchUsers();
    }
  }, [currentUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    // --- ИЗМЕНЕНИЕ: Убираем проверку суммы ---
    if (!receiverId || !message) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }
    // --- ИЗМЕНЕНИЕ: Убираем проверку баланса ---
    // if (user.balance < amount) { ... }
    
    setIsLoading(true);

    try {
      // --- ИЗМЕНЕНИЕ: Формируем объект без amount ---
      const transferData = {
        sender_id: currentUserId,
        receiver_id: parseInt(receiverId, 10),
        message: message,
      };
      
      await transferPoints(transferData);
      setSuccess('Баллы успешно отправлены!');
      
      setReceiverId('');
      setMessage('');
      
      // Вызываем колбэк для возврата на главную и обновления ленты
      setTimeout(() => {
        if(onTransferSuccess) onTransferSuccess();
      }, 1000);
      
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Произошла ошибка.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout title="Отправить спасибку">
      <button onClick={onBack} className={styles.backButton}>&larr; Назад</button>
      
      {/* Отображаем дневной лимит, если он есть в данных пользователя */}
      {user?.daily_transfer_count !== undefined && (
          <div className={styles.balanceInfo}>
              <p>Переводов сегодня: <strong>{user.daily_transfer_count} / 3</strong></p>
          </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Кому:</label>
          <select value={receiverId} onChange={(e) => setReceiverId(e.target.value)} className={styles.select}>
            <option value="">Выберите сотрудника</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.first_name} {u.last_name} ({u.position})
              </option>
            ))}
          </select>
        </div>

        {/* --- ИЗМЕНЕНИЕ: Полностью удаляем блок для ввода суммы --- */}

        <div className={styles.formGroup}>
          <label className={styles.label}>За что (обязательно):</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Например, за помощь с отчетом"
            rows="3"
            className={styles.textarea}
          ></textarea>
        </div>
        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Отправка...' : 'Отправить спасибку'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </form>
    </PageLayout>
  );
}

export default TransferPage;
