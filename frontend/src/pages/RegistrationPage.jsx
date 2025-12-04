// frontend/src/pages/RegistrationPage.jsx

import React, { useState } from 'react';
import InputMask from 'react-input-mask';
import { registerUser } from '../api';
import styles from './RegistrationPage.module.css';
import PageLayout from '../components/PageLayout';
import { useModalAlert } from '../contexts/ModalAlertContext';

// --- НОВАЯ ФУНКЦИЯ: Конвертирует дату из DD.MM.YYYY в YYYY-MM-DD ---
const formatDateForApi = (date) => {
  if (!date || date.includes('_')) return null;
  const parts = date.split('.');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month}-${day}`;
  }
  return null;
};

function RegistrationPage({ telegramUser, onRegistrationSuccess }) {
  const { showAlert } = useModalAlert();
  const [formData, setFormData] = useState({
    firstName: telegramUser?.first_name || '',
    lastName: '',
    department: '',
    position: '',
    phoneNumber: '',
    dateOfBirth: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // --- НОВАЯ ФУНКЦИЯ: Проверка всех полей перед отправкой ---
  const validateForm = () => {
    const newErrors = {};
    if (!formData.firstName.trim()) newErrors.firstName = 'Имя обязательно';
    if (!formData.lastName.trim()) newErrors.lastName = 'Фамилия обязательна';
    if (!formData.department.trim()) newErrors.department = 'Подразделение обязательно';
    if (!formData.position.trim()) newErrors.position = 'Должность обязательна';
    if (formData.phoneNumber.includes('_')) newErrors.phoneNumber = 'Введите телефон полностью';
    if (formData.dateOfBirth.includes('_')) newErrors.dateOfBirth = 'Введите дату полностью';
    
    // Проверка формата даты
    const formattedDate = formatDateForApi(formData.dateOfBirth);
    if (!formattedDate && !formData.dateOfBirth.includes('_')) {
        newErrors.dateOfBirth = 'Неверный формат даты';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showAlert('Пожалуйста, заполните все обязательные поля корректно.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const apiDate = formatDateForApi(formData.dateOfBirth);

      const userData = {
        telegram_id: String(telegramUser?.id || ''),
        first_name: formData.firstName,
        last_name: formData.lastName,
        department: formData.department,
        position: formData.position,
        username: telegramUser?.username || null,
        telegram_photo_url: telegramUser?.photo_url || null,
        phone_number: formData.phoneNumber,
        date_of_birth: apiDate,
      };

      await registerUser(telegramUser.id, userData);
      showAlert('Ваша заявка отправлена на рассмотрение!', 'success');
      
      setTimeout(() => {
        onRegistrationSuccess(); 
      }, 1500);

    } catch (err) {
      showAlert(err.response?.data?.detail || 'Не удалось отправить заявку.', 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout title="Регистрация">
      <p className={styles.subtitle}>
        Привет, {telegramUser?.first_name || 'друг'}! Для завершения настройки, пожалуйста, укажите вашу информацию.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        <input name="firstName" type="text" value={formData.firstName} onChange={handleChange} placeholder="Ваше имя" className={styles.input} />
        {errors.firstName && <p className={styles.error}>{errors.firstName}</p>}

        <input name="lastName" type="text" value={formData.lastName} onChange={handleChange} placeholder="Ваша фамилия" className={styles.input} />
        {errors.lastName && <p className={styles.error}>{errors.lastName}</p>}

        <input name="department" type="text" value={formData.department} onChange={handleChange} placeholder="Ваше подразделение" className={styles.input} />
        {errors.department && <p className={styles.error}>{errors.department}</p>}
        
        <input name="position" type="text" value={formData.position} onChange={handleChange} placeholder="Ваша должность" className={styles.input} />
        {errors.position && <p className={styles.error}>{errors.position}</p>}
        
        <InputMask
          mask="+7 (999) 999-99-99"
          name="phoneNumber"
          value={formData.phoneNumber}
          onChange={handleChange}
          className={styles.input}
        >
          {(inputProps) => <input {...inputProps} type="tel" placeholder="Номер телефона" />}
        </InputMask>
        {errors.phoneNumber && <p className={styles.error}>{errors.phoneNumber}</p>}

        {/* --- ИЗМЕНЕНИЕ: Формат даты DD.MM.YYYY --- */}
        <InputMask
          mask="99.99.9999"
          name="dateOfBirth"
          value={formData.dateOfBirth}
          onChange={handleChange}
          className={styles.input}
        >
          {(inputProps) => <input {...inputProps} type="text" placeholder="Дата рождения (ДД.ММ.ГГГГ)" />}
        </InputMask>
        {errors.dateOfBirth && <p className={styles.error}>{errors.dateOfBirth}</p>}

        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Отправка...' : 'Отправить на рассмотрение'}
        </button>
      </form>
    </PageLayout>
  );
}

export default RegistrationPage;
