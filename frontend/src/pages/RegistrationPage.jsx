import React, { useState } from 'react';
import { registerUser } from '../api';

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
        first_name: telegramUser.first_name,
        username: telegramUser.username,
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
        Привет, {telegramUser.first_name}! Для завершения настройки, пожалуйста, укажите вашу должность.
      </p>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Например, 'Разработчик'"
          style={{ width: '80%', padding: '10px', marginBottom: '10px' }}
        />
        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ваша фамилия" />
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ваше подразделение" />
        <button type="submit" disabled={isLoading} style={{ width: '82%', padding: '10px' }}>
          {isLoading ? 'Регистрация...' : 'Завершить регистрацию'}
        </button>
        {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
      </form>
    </div>
  );
}

export default RegistrationPage;
