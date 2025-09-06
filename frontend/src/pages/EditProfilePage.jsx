// frontend/src/pages/EditProfilePage.jsx
// (НОВЫЙ ФАЙЛ)

import React, { useState } from 'react';
import { requestProfileUpdate } from '../api'; // Наша новая API функция
import styles from './RegistrationPage.module.css'; // Мы можем использовать те же стили, что и при регистрации
import PageLayout from '../components/PageLayout';

// Принимаем текущего пользователя (чтобы заполнить поля) и колбэки
function EditProfilePage({ user, onBack, onSaveSuccess }) {
  
  // 1. Заполняем состояние текущими данными пользователя
  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [position, setPosition] = useState(user?.position || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  // Дата должна быть в формате YYYY-MM-DD для input type="date"
  const [dateOfBirth, setDateOfBirth] = useState(user?.date_of_birth || '');
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // 2. Добавляем Имя в проверку
    if (!firstName || !lastName || !department || !position) { // <-- ИЗМЕНИТЬ
      setError('Имя, Фамилия, подразделение и должность обязательны.'); // <-- ИЗМЕНИТЬ
      return;
    }
    setIsLoading(true);
    setError('');

    try {
      const updatedData = {
        first_name: firstName, // <-- ДОБАВИТЬ
        last_name: lastName,
        department: department,
        position: position,
        phone_number: phoneNumber || "", 
        date_of_birth: dateOfBirth || "",
      };
      
      // 2. Вызываем наш новый API эндпоинт
      await requestProfileUpdate(updatedData);
      
      // 3. Вызываем колбэк (он покажет плашку и вернет в профиль)
      onSaveSuccess();

    } catch (err) {
      // Отображаем ошибку (например, "Изменений не найдено" или 500)
      setError(err.response?.data?.detail || 'Не удалось отправить запрос. Попробуйте снова.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout title="Редактирование профиля">
      <button onClick={onBack} className={styles.backButton}>&larr; Назад в профиль</button>
      <p className={styles.subtitle}>
        Ваши изменения будут отправлены на проверку администратору.
      </p>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Имя (first_name) и Telegram ID/username мы не даем менять, они из ТГ */}
        <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Ваше имя" className={styles.input} required />
        <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Ваша фамилия" className={styles.input} required />
        <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Ваше подразделение" className={styles.input} required />
        <input type="text" value={position} onChange={(e) => setPosition(e.target.value)} placeholder="Ваша должность" className={styles.input} required />
        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="Номер телефона (необязательно)" className={styles.input} />
        {/* Используем трюк для placeholder'а у input[type=date] */}
        <input type="text" onFocus={(e) => e.target.type = 'date'} onBlur={(e) => {if (!e.target.value) e.target.type = 'text'}} value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} placeholder="Дата рождения (необязательно)" className={styles.input} />

        <button type="submit" disabled={isLoading} className={styles.submitButton}>
          {isLoading ? 'Отправка...' : 'Отправить на согласование'}
        </button>
        {error && <p className={styles.error}>{error}</p>}
      </form>
    </PageLayout>
  );
}

export default EditProfilePage;
