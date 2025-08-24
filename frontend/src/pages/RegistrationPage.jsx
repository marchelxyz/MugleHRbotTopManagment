// frontend/src/pages/RegistrationPage.jsx

import React, { useState } from 'react';
import { registerUser } from '../api';
import styles from './RegistrationPage.module.css';

function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  // --- ИЗМЕНЕНИЕ: Добавляем состояние для имени ---
  const [firstName, setFirstName] = useState(telegramUser?.first_name || '');
  const [lastName, setLastName] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // --- ИЗМЕНЕНИЕ: Добавляем проверку имени ---
    if (!firstName || !lastName || !department || !position) {
      setError('Пожалуйста, заполните все обязательные поля.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const userData = {
        telegram_id: String(telegramUser.id),
        // --- ИЗМЕНЕНИЕ: Отправляем имя ---
        first_name: firstName,
        last_name: lastName,
        department: department,
        position: position,
        username: telegramUser.username,
        phone_number: phoneNumber,
        date_of_birth: dateOfBirth,
      };

      await registerUser(telegramUser.id, userData);
      // --- ИЗМЕНЕНИЕ: Меняем сообщение ---
      alert('Ваша заявка отправлена на рассмотрение!');
      onRegistrationSuccess();
    } catch (err) {
      setError('Не удалось отправить заявку. Попробуйте снова.');
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
        {/* --- ИЗМЕНЕНИЕ: Добавляем поле для имени --- */}
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Ваше имя"
          className={styles.input}
          required
        />
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Ваша фамилия"
          className={styles.input}
          required
        />
        {/* ... (остальные поля без изменений) ... */}
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ваше подразделение" className={styles.input} required />
        <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Ваша должность" className={styles.input} required />
        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Номер телефона" className={styles.input} />
        <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => e.target.type = 'text'} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder="Дата рождения" className={styles.input} />

        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Отправка...' : 'Отправить на рассмотрение'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </div>
  );
}

export default RegistrationPage;
