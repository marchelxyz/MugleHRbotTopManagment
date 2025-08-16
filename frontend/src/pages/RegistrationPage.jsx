// frontend/src/pages/RegistrationPage.jsx

import React, { useState } from 'react';
import { registerUser } from '../api';
import styles from './RegistrationPage.module.css';

function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  // --- 1. ДОБАВЛЯЕМ СОСТОЯНИЯ ДЛЯ НОВЫХ ПОЛЕЙ ---
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  // --- КОНЕЦ ИЗМЕНЕНИЙ ---
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!position || !lastName || !department) {
      setError('Пожалуйста, заполните все обязательные поля.');
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
        username: telegramUser.username,
        // --- 2. ОТПРАВЛЯЕМ НОВЫЕ ДАННЫЕ ---
        phone_number: phoneNumber,
        date_of_birth: dateOfBirth,
        // --- КОНЕЦ ИЗМЕНЕНИЙ ---
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
    <div className={styles.page}>
      <h1>Добро пожаловать!</h1>
      <p>
        Привет, {telegramUser.first_name}! Для завершения настройки, пожалуйста, укажите вашу информацию.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Ваше имя"
          className={styles.input}
          required
        />
        <input
          type="text"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          placeholder="Ваше подразделение"
          className={styles.input}
          required
        />
        <input
          type="text"
          value={position}
          onChange={(e) => setPosition(e.target.value)}
          placeholder="Ваша должность"
          className={styles.input}
          required
        />
        
        {/*--- 3. ДОБАВЛЯЕМ НОВЫЕ ПОЛЯ В ФОРМУ ---*/}
        <input
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Номер телефона (необязательно)"
          className={styles.input}
        />
        <input
          type="text"
          onFocus={(e) => e.target.type = 'date'}
          onBlur={(e) => e.target.type = 'text'}
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          placeholder="Дата рождения (необязательно)"
          className={styles.input}
        />
        {/*--- КОНЕЦ ИЗМЕНЕНИЙ ---*/}

        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Регистрация...' : 'Завершить регистрацию'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

export default RegistrationPage;
