// frontend/src/pages/BrowserRegistrationPage.jsx

import React, { useState } from 'react';
import { registerBrowserUser } from '../api';
import styles from './LoginPage.module.css';

function BrowserRegistrationPage() {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    login: '',
    password: '',
    confirmPassword: '',
    department: '',
    position: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Очищаем ошибку для поля при изменении
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.first_name.trim()) {
      newErrors.first_name = 'Имя обязательно';
    }
    if (!formData.last_name.trim()) {
      newErrors.last_name = 'Фамилия обязательна';
    }
    if (!formData.email.trim()) {
      newErrors.email = 'Email обязателен';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Неверный формат email';
    }
    if (!formData.login.trim()) {
      newErrors.login = 'Логин обязателен';
    } else if (formData.login.length < 3) {
      newErrors.login = 'Логин должен быть не менее 3 символов';
    }
    if (!formData.password) {
      newErrors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Пароль должен быть не менее 6 символов';
    }
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Пароли не совпадают';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const userData = {
        first_name: formData.first_name,
        last_name: formData.last_name,
        email: formData.email,
        login: formData.login,
        password: formData.password,
        department: formData.department || null,
        position: formData.position || null,
      };

      await registerBrowserUser(userData);
      
      // После успешной регистрации перенаправляем на страницу входа
      alert('Регистрация успешна! Теперь вы можете войти в систему.');
      window.location.href = '/';
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Ошибка при регистрации. Попробуйте еще раз.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox} style={{ maxWidth: '500px' }}>
        <h1 className={styles.title}>Регистрация</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="first_name">Имя *</label>
            <input
              id="first_name"
              name="first_name"
              type="text"
              value={formData.first_name}
              onChange={handleChange}
              required
              disabled={loading}
            />
            {errors.first_name && <span className={styles.fieldError}>{errors.first_name}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="last_name">Фамилия *</label>
            <input
              id="last_name"
              name="last_name"
              type="text"
              value={formData.last_name}
              onChange={handleChange}
              required
              disabled={loading}
            />
            {errors.last_name && <span className={styles.fieldError}>{errors.last_name}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="email">Email *</label>
            <input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              required
              autoComplete="email"
              disabled={loading}
            />
            {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="login">Логин *</label>
            <input
              id="login"
              name="login"
              type="text"
              value={formData.login}
              onChange={handleChange}
              required
              autoComplete="username"
              disabled={loading}
            />
            {errors.login && <span className={styles.fieldError}>{errors.login}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Пароль *</label>
            <input
              id="password"
              name="password"
              type="password"
              value={formData.password}
              onChange={handleChange}
              required
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="confirmPassword">Подтвердите пароль *</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              autoComplete="new-password"
              disabled={loading}
            />
            {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="department">Подразделение</label>
            <input
              id="department"
              name="department"
              type="text"
              value={formData.department}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="position">Должность</label>
            <input
              id="position"
              name="position"
              type="text"
              value={formData.position}
              onChange={handleChange}
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Регистрация...' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Уже есть аккаунт?{' '}
            <a href="/login" style={{ color: '#2196F3', textDecoration: 'none' }}>
              Войти
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default BrowserRegistrationPage;
