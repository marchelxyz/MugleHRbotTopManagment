// frontend/src/pages/RegistrationPage.jsx

import React, { useState } from 'react';
import { registerUser } from '../api';

function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  // ИСПРАВЛЕНИЕ: Добавляем недостающие состояния
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // ИСПРАВЛЕНИЕ: Улучшенная проверка на заполнение полей
    if (!position || !lastName || !department) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      // ИСПРАВЛЕНИЕ: Формируем правильный объект для отправки на бэкенд
      const userData = {
        telegram_id: String(telegramUser.id),
        last_name: lastName,
        department: department,
        position: position,
      };

      await registerUser(telegramUser.id, userData);
      alert('Вы успешно зарегистрированы!');
      onRegistrationSuccess();
    } catch (err) {
      setError('Не удалось зарегистрироваться. Попробуйте снова.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Добро пожаловать!</h1>
      <p>
        Привет, {telegramUser.first_name}! Для завершения настройки, пожалуйста, укажите вашу должность, фамилию и подразделение.
      </p>
      <form onSubmit={handleSubmit}>
        {/* ИСПРАВЛЕНИЕ: Поля теперь правильно подключены к состоянию */}
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Ваша фамилия"
          style={{ width: '80%', padding: '10px', marginBottom: '10px' }}
        />
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Ваше подразделение"
          style={{ width: '80%', padding: '10px', marginBottom: '10px' }}
        />
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Ваша должность (например, 'Разработчик')"
          style={{ width: '80%', padding: '10px', marginBottom: '10px' }}
        />
        <button type="submit" disabled={isLoading} style={{ width: '82%', padding: '10px' }}>
          {isLoading ? 'Регистрация...' : 'Завершить регистрацию'}
        </button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </form>
    </div>
  );
}

export default RegistrationPage;
