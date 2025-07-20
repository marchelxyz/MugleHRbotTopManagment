// frontend/src/pages/AdminPage.jsx
import React, { useState } from 'react';
import { addPointsToAll } from '../api'; // Мы создадим эту функцию в api.js
import styles from './AdminPage.module.css';

function AdminPage() {
  const [amount, setAmount] = useState(100);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleAddPoints = async () => {
    if (!window.confirm(`Вы уверены, что хотите начислить ${amount} баллов всем пользователям?`)) {
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const response = await addPointsToAll({ amount: parseInt(amount, 10) });
      setMessage(response.data.detail);
    } catch (error) {
      setMessage(`Ошибка: ${error.response?.data?.detail || 'Не удалось выполнить операцию'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <h1>⚙️ Админ-панель</h1>

      <div className={styles.card}>
        <h2>Начислить баллы всем</h2>
        <p>Это действие добавит указанное количество баллов каждому зарегистрированному пользователю.</p>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={styles.input}
        />
        <button onClick={handleAddPoints} disabled={loading} className={styles.button}>
          {loading ? 'Начисление...' : `Начислить ${amount} баллов`}
        </button>
        {message && <p className={styles.message}>{message}</p>}
      </div>
    </div>
  );
}

export default AdminPage;
