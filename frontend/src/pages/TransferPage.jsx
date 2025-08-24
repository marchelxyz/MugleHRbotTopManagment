// frontend/src/pages/TransferPage.jsx

import React, { useState, useEffect } from 'react';
import { getAllUsers, transferPoints } from '../api';
import styles from './TransferPage.module.css';
import PageLayout from '../components/PageLayout';

const tg = window.Telegram.WebApp;

// 1. Принимаем полного 'user' в пропсах
function TransferPage({ user, onBack, onTransferSuccess }) {
  const [users, setUsers] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentUserId = user?.id; // Используем наш ID из БД

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getAllUsers();
        // Фильтруем список, чтобы нельзя было отправить баллы самому себе
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
    if (!receiverId || !amount || !message) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }
    if (user.balance < amount) {
        setError('У вас недостаточно баллов для этого перевода.');
        return;
    }
    setIsLoading(true);

    try {
      // 2. Формируем правильный объект с sender_id
      const transferData = {
        sender_id: currentUserId,
        receiver_id: parseInt(receiverId, 10),
        amount: parseInt(amount, 10),
        message: message,
      };
      
      await transferPoints(transferData);
      setSuccess('Баллы успешно отправлены!');
      // Очищаем поля
      setReceiverId('');
      setAmount('');
      setMessage('');
      // Тут можно добавить логику для обновления баланса на фронте
      // --- ИЗМЕНЕНИЕ: Вызываем колбэк после успешной отправки ---
      // Он вернет нас на главную и очистит кэш ленты
      setTimeout(() => {
      onTransferSuccess();
      }, 1000); // Небольшая задержка, чтобы пользователь успел увидеть сообщение
      
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Произошла ошибка.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout title="Отправить спасибки">
      <button onClick={onBack} className={styles.backButton}>&larr; Назад</button>
       <div className={styles.balanceInfo}>
        <p>Для переводов: <strong>{user?.transfer_balance}</strong> спасибок</p>
        <p>Переводов сегодня: <strong>{user?.daily_transfer_count || 0} / 3</strong></p>
      </div>
      <p>Ваш баланс: {user?.balance} спасибок</p>
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Кому:</label>
          <select value={receiverId} onChange={(e) => setReceiverId(e.target.value)} className={styles.select}>
            <option value="">Выберите сотрудника</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.last_name} ({u.position})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Сколько спасибок:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Например, 20"
            className={styles.input}
            min="1"
            max="10"
          />
        </div>
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
          {isLoading ? 'Отправка...' : 'Отправить'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </form>
    </PageLayout>
  );
}

export default TransferPage;
