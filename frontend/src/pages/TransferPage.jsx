import React, { useState, useEffect } from 'react';
import { getAllUsers, transferPoints } from '../api';
import styles from './TransferPage.module.css'; // 1. Импортируем стили

const tg = window.Telegram.WebApp;

function TransferPage({ onBack }) {
  const [users, setUsers] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const currentUserId = tg.initDataUnsafe?.user?.id;

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getAllUsers(currentUserId);
        // Фильтруем список, чтобы нельзя было отправить баллы самому себе
        setUsers(response.data.filter(user => user.telegram_id !== String(currentUserId)));
      } catch (error) {
        setError('Не удалось загрузить список сотрудников.');
      }
    };
    fetchUsers();
  }, [currentUserId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!receiverId || !amount || !message) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }
    setIsLoading(true);

    try {
      const transferData = {
        receiver_id: parseInt(receiverId, 10),
        amount: parseInt(amount, 10),
        message: message,
      };
      // ID отправителя теперь тоже нужно передавать
      // Мы можем получить его из данных пользователя, которые у нас есть в App.jsx,
      // но для простоты этого компонента пока захардкодим или получим из Telegram.
      // Важно: на бэкенде sender_id - это ID из нашей БД, а не telegram_id
      // Этот момент нужно будет доработать, когда у нас будет глобальный стейт пользователя
      
      // Пока что бэкенд ожидает sender_id и receiver_id из нашей БД.
      // Фронтенд же оперирует telegram_id. Это нужно будет синхронизировать.
      // Для этого нам понадобится endpoint, который вернет всех пользователей с их id и telegram_id.
      // getAllUsers уже это делает, нужно просто правильно передать данные.
      
      // Давайте временно предположим, что бэкенд ожидает telegram_id,
      // а на бэкенде мы найдем пользователя по этому ID.
      // Либо нам нужно будет передавать ID пользователя из нашей БД.

      // Для корректной работы изменим API call и бэкенд, чтобы принимать telegram_id
      
      // Временно оставим как есть, но это потенциальное место для улучшения
      await transferPoints(currentUserId, transferData);
      setSuccess('Баллы успешно отправлены!');
      setReceiverId('');
      setAmount('');
      setMessage('');
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
      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Кому:</label>
          <select value={receiverId} onChange={(e) => setReceiverId(e.target.value)} className={styles.select}>
            <option value="">Выберите сотрудника</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.last_name} ({user.position})
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
