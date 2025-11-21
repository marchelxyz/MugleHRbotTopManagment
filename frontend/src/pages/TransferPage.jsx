// frontend/src/pages/TransferPage.jsx

import React, { useState, useEffect, useRef } from 'react';
import { getAllUsers, transferPoints } from '../api';
import styles from './TransferPage.module.css';
import PageLayout from '../components/PageLayout';

function UserSearch({ currentUser, onUserSelect }) {
  const [query, setQuery] = useState('');
  const [allUsers, setAllUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isListVisible, setIsListVisible] = useState(false);
  const searchContainerRef = useRef(null);

  // Загружаем всех пользователей при монтировании компонента
  useEffect(() => {
    loadAllUsers();
  }, []);

  // Фильтруем пользователей при изменении запроса
  useEffect(() => {
    if (query.trim() === '') {
      // Если запрос пустой, показываем всех пользователей
      setFilteredUsers(allUsers);
    } else {
      const searchLower = query.toLowerCase();
      const filtered = allUsers.filter(user => 
        user.first_name?.toLowerCase().includes(searchLower) ||
        user.last_name?.toLowerCase().includes(searchLower) ||
        user.username?.toLowerCase().includes(searchLower) ||
        user.phone_number?.toLowerCase().includes(searchLower) ||
        `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchLower) ||
        (user.username && `@${user.username}`.toLowerCase().includes(searchLower))
      );
      setFilteredUsers(filtered);
    }
  }, [query, allUsers]);

  const loadAllUsers = async () => {
    setIsLoading(true);
    try {
      const telegramId = window.Telegram.WebApp.initDataUnsafe?.user?.id;
      const response = await getAllUsers(telegramId);
      // Фильтруем текущего пользователя и сортируем по имени в алфавитном порядке
      const users = response.data
        .filter(u => u.id !== currentUser.id)
        .sort((a, b) => {
          const nameA = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase();
          const nameB = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase();
          return nameA.localeCompare(nameB, 'ru');
        });
      setAllUsers(users);
      setFilteredUsers(users);
    } catch (error) {
      console.error("Ошибка загрузки пользователей:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setQuery(value);
  };

  const handleFocus = () => {
    setIsFocused(true);
    setIsListVisible(true);
  };

  const handleBlur = (e) => {
    // Проверяем, не кликнули ли мы на элемент списка
    if (searchContainerRef.current && !searchContainerRef.current.contains(e.relatedTarget)) {
      setIsFocused(false);
      // Небольшая задержка, чтобы клик по элементу успел обработаться
      setTimeout(() => setIsListVisible(false), 200);
    }
  };

  const handleUserClick = (user) => {
    setQuery(`${user.first_name} ${user.last_name}`);
    setIsListVisible(false);
    setIsFocused(false);
    onUserSelect(user);
  };

  // Обработка клика вне компонента
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target)) {
        setIsListVisible(false);
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.searchContainer} ref={searchContainerRef}>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder="Введите имя, фамилию, тег или номер телефона..."
        className={styles.input}
      />
      {isLoading && <div className={styles.loader}>Загрузка...</div>}
      {isListVisible && filteredUsers.length > 0 && (
        <div className={styles.searchResults}>
          {filteredUsers.map((user) => (
            <div 
              key={user.id} 
              onClick={() => handleUserClick(user)} 
              className={styles.searchResultItem}
              onMouseDown={(e) => e.preventDefault()} // Предотвращаем blur при клике
            >
              <div className={styles.userName}>
                {user.first_name} {user.last_name}
              </div>
              {user.position && (
                <div className={styles.userPosition}>{user.position}</div>
              )}
            </div>
          ))}
        </div>
      )}
      {isListVisible && !isLoading && filteredUsers.length === 0 && query.trim() !== '' && (
        <div className={styles.searchResults}>
          <div className={styles.noResults}>Пользователи не найдены</div>
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
