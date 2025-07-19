// frontend/src/pages/RegistrationPage.jsx

import React, { useState } from 'react';
import { registerUser } from '../api';
import styles from './RegistrationPage.module.css'; // 1. Импортируем стили

function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position || !lastName || !department) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
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
    // 2. Применяем классы
    <div className={styles.page}>
      <h1>Добро пожаловать!</h1>
      <p>
        Привет, {telegramUser.first_name}! Для завершения настройки, пожалуйста, укажите вашу должность, фамилию и подразделение.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Ваша фамилия"
          className={styles.input}
        />
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Ваше подразделение"
          className={styles.input}
        />
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Ваша должность"
          className={styles.input}
        />
        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Регистрация...' : 'Завершить регистрацию'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

export default RegistrationPage;
