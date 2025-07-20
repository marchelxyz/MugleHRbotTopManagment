// frontend/src/pages/TransferPage.jsx

import React, { useState, useEffect } from 'react';
import { getAllUsers, transferPoints } from '../api';
import styles from './TransferPage.module.css';

const tg = window.Telegram.WebApp;

// 1. Принимаем полного 'user' в пропсах
function TransferPage({ user, onBack }) {
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
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Произошла ошибка.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <button onClick={onBack} className={styles.backButton}>&larr; Назад</button>
      <h1>Передать баллы</h1>
      <p>Ваш баланс: {user?.balance} баллов</p>
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
          <label className={styles.label}>Сколько баллов:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Например, 20"
            className={styles.input}
            min="1"
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
    </div>
  );
}

export default TransferPage;
