// frontend/src/pages/RegistrationPage.jsx

import React, { useState } from 'react';
import InputMask from 'react-input-mask'; // 1. Импортируем компонент маски
import { registerUser } from '../api';
import styles from './RegistrationPage.module.css';
import PageLayout from '../components/PageLayout';
import { useModalAlert } from '../contexts/ModalAlertContext';

function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  const { showAlert } = useModalAlert();
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
    // 2. Обновляем проверку на обязательные поля
    if (!firstName || !lastName || !department || !position || !phoneNumber || !dateOfBirth) {
      setError('Пожалуйста, заполните все поля.');
      return;
    }
    // Проверка, что телефон и дата введены полностью
    if (phoneNumber.includes('_')) {
      setError('Пожалуйста, введите номер телефона полностью.');
      return;
    }
    if (dateOfBirth.includes('_')) {
      setError('Пожалуйста, введите дату рождения полностью.');
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

      await registerUser(telegramUser.id, userData);
      
      showAlert('Ваша заявка отправлена на рассмотрение!', 'success');
      
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
    <PageLayout title="Регистрация">
      <p className={styles.subtitle}>
        Привет, {telegramUser.first_name}! Для завершения настройки, пожалуйста, укажите вашу информацию.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ваше имя" className={styles.input} required />
        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ваша фамилия" className={styles.input} required />
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ваше подразделение" className={styles.input} required />
        <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Ваша должность" className={styles.input} required />
        
        {/* 3. Заменяем обычные input на InputMask */}
        <InputMask
          mask="+7 (999) 999-99-99"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          className={styles.input}
          required
        >
          {(inputProps) => <input {...inputProps} type="tel" placeholder="Номер телефона" />}
        </InputMask>

        <InputMask
          mask="9999-99-99"
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
          className={styles.input}
          required
        >
          {(inputProps) => <input {...inputProps} type="text" placeholder="Дата рождения (ГГГГ-ММ-ДД)" />}
        </InputMask>

        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Отправка...' : 'Отправить на рассмотрение'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </PageLayout>
  );
}

export default RegistrationPage;
