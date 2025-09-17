// frontend/src/pages/RegistrationPage.jsx

import React, { useState } from 'react';
import { registerUser } from '../api';
import styles from './RegistrationPage.module.css';
import PageLayout from '../components/PageLayout'; // 1. Импортируем Layout
import { useModalAlert } from '../contexts/ModalAlertContext'; // 1. Импортируем

function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  const { showAlert } = useModalAlert(); // 2. Получаем функцию
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
    if (!firstName || !lastName || !department || !position) {
      setError('Пожалуйста, заполните все обязательные поля.');
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const userData = {
        telegram_id: String(telegramUser.id),
        first_name: firstName,
        last_name: lastName,
        department: department,
        position: position,
        username: telegramUser.username,
        telegram_photo_url: telegramUser.photo_url || null,
        phone_number: phoneNumber,
        date_of_birth: dateOfBirth,
      };

      const response = await registerUser(telegramUser.id, userData);
      
      // 3. Заменяем alert() на showAlert()
      showAlert('Ваша заявка отправлена на рассмотрение!', 'success');
      
      // Небольшая задержка, чтобы пользователь успел увидеть уведомление
      setTimeout(() => {
        onRegistrationSuccess(); 
      }, 1500);

    } catch (err) {
      setError('Не удалось отправить заявку. Попробуйте снова.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // 2. Оборачиваем всё в PageLayout с заголовком
    <PageLayout title="Регистрация">
      <p className={styles.subtitle}>
        Привет, {telegramUser.first_name}! Для завершения настройки, пожалуйста, укажите вашу информацию.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ваше имя" className={styles.input} required />
        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ваша фамилия" className={styles.input} required />
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ваше подразделение" className={styles.input} required />
        <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Ваша должность" className={styles.input} required />
        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Номер телефона (необязательно)" className={styles.input} />
        <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => e.target.type = 'text'} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder="Дата рождения (необязательно)" className={styles.input} />

        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Отправка...' : 'Отправить на рассмотрение'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </PageLayout>
  );
}

export default RegistrationPage;
