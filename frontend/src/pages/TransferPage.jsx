import React, { useState, useEffect } from 'react';
import { getAllUsers, transferPoints } from './api';

// Получаем ID текущего пользователя из Telegram
const tg = window.Telegram.WebApp;
const currentUserId = tg.initDataUnsafe?.user?.id;

function TransferPage({ onBack }) {
  const [users, setUsers] = useState([]);
  const [receiverId, setReceiverId] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Загружаем список пользователей при открытии страницы
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await getAllUsers(currentUserId);
        setUsers(response.data);
      } catch (error) {
        setError('Не удалось загрузить список сотрудников.');
      }
    };
    fetchUsers();
  }, []);

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
        receiver_telegram_id: parseInt(receiverId, 10),
        amount: parseInt(amount, 10),
        message: message,
      };
      await transferPoints(currentUserId, transferData);
      setSuccess('Баллы успешно отправлены!');
      // Очищаем поля
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
    <div style={{ padding: '20px' }}>
      <button onClick={onBack} style={{ marginBottom: '20px' }}>&larr; Назад</button>
      <h1>Передать баллы</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label>Кому:</label>
          <select value={receiverId} onChange={(e) => setReceiverId(e.target.value)} style={{ width: '100%', padding: '8px', marginTop: '5px' }}>
            <option value="">Выберите сотрудника</option>
            {users.map((user) => (
              <option key={user.telegram_id} value={user.telegram_id}>
                {user.first_name} ({user.position})
              </option>
            ))}
          </select>
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>Сколько баллов:</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Например, 20"
            style={{ width: '95%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label>За что (обязательно):</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Например, за помощь с отчетом"
            rows="3"
            style={{ width: '95%', padding: '8px', marginTop: '5px' }}
          ></textarea>
        </div>
        <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '10px' }}>
          {isLoading ? 'Отправка...' : 'Отправить'}
        </button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
        {success && <p style={{ color: 'green', marginTop: '10px' }}>{success}</p>}
      </form>
    </div>
  );
}

export default TransferPage;
