// frontend/src/RegistrationPage.jsx
import React, { useState } from 'react';
import { registerUser } from './api';

// Компонент получает в качестве props данные о пользователе из Telegram
// и функцию, которую нужно вызвать после успешной регистрации.
function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position) {
      setError('Пожалуйста, укажите вашу должность.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const userData = {
        firstName: telegramUser.first_name,
        username: telegramUser.username,
        position: position,
      };
      // Вызываем функцию API для регистрации
      await registerUser(telegramUser.id, userData);
      alert('Вы успешно зарегистрированы!');
      onRegistrationSuccess(); // Сообщаем главному компоненту об успехе
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
        Привет, {telegramUser.first_name}! Для завершения настройки, пожалуйста,
        укажите вашу должность.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Например, 'Разработчик'"
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
