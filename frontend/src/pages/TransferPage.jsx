// frontend/src/pages/TransferPage.jsx

import React, { useState, useCallback } from 'react';
import { searchUsers, transferPoints } from '../api';
import styles from './TransferPage.module.css';
import PageLayout from '../components/PageLayout';

const debounce = (func, delay) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

function UserSearch({ currentUser, onUserSelect }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const performSearch = async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    try {
      const response = await searchUsers(searchQuery);
      setResults(response.data.filter(u => u.id !== currentUser.id));
    } catch (error) {
      console.error("Ошибка поиска:", error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const debouncedSearch = useCallback(debounce(performSearch, 300), [currentUser.id]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
    setIsLoading(true);
    debouncedSearch(value);
  };

  const handleUserClick = (user) => {
    setQuery(`${user.first_name} ${user.last_name}`);
    setResults([]);
    onUserSelect(user);
  };

  return (
    <div className={styles.searchContainer}>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        placeholder="Введите имя, фамилию или @username..."
        className={styles.input}
      />
      {isLoading && <div className={styles.loader}>Поиск...</div>}
      {results.length > 0 && (
        <div className={styles.searchResults}>
          {results.map((user) => (
            <div key={user.id} onClick={() => handleUserClick(user)} className={styles.searchResultItem}>
              {user.first_name} {user.last_name} ({user.position})
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function TransferPage({ user, onBack, onTransferSuccess }) {
  const [receiver, setReceiver] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // --- ИСПРАВЛЕНИЕ №1: Проверка на наличие user для предотвращения падения ---
  if (!user) {
    return <PageLayout title="Отправить спасибку"><div className="loading-container">Загрузка...</div></PageLayout>;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!receiver || !message) {
      setError('Пожалуйста, выберите получателя и напишите сообщение.');
      return;
    }
    
    setIsLoading(true);

    try {
      const transferData = {
        sender_id: user.id,
        receiver_id: receiver.id,
        message: message,
      };
      
      const response = await transferPoints(transferData);
      setSuccess('Спасибка успешно отправлена!');
      
      setReceiver(null);
      setMessage('');
      
      // --- ИСПРАВЛЕНИЕ №2: Передаем обновленные данные в App.jsx ---
      setTimeout(() => {
      if (onTransferSuccess) {
        onTransferSuccess(response.data); // Передаем обновленные данные наверх
      }
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
      
      <div className={styles.balanceInfo}>
          <p>Переводов сегодня: <strong>{3 - user.daily_transfer_count} / 3</strong></p>
      </div>

      <form onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Кому:</label>
          <UserSearch currentUser={user} onUserSelect={setReceiver} />
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
        <button type="submit" disabled={isLoading || !receiver} className={styles.submitButton}>
          {isLoading ? 'Отправка...' : 'Отправить спасибку'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>{success}</p>}
      </form>
    </PageLayout>
  );
}

export default TransferPage;
