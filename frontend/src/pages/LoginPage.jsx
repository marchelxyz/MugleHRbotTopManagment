// frontend/src/pages/LoginPage.jsx

import React, { useState } from 'react';
import { loginUser } from '../api';
import styles from './LoginPage.module.css';
import PageLayout from '../components/PageLayout';
import { useModalAlert } from '../contexts/ModalAlertContext';

function LoginPage({ onLoginSuccess, onShowRegistration }) {
  const { showAlert } = useModalAlert();
  const [formData, setFormData] = useState({
    login: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.login.trim()) newErrors.login = 'Логин обязателен';
    if (!formData.password.trim()) newErrors.password = 'Пароль обязателен';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      showAlert('Пожалуйста, заполните все поля.', 'error');
      return;
    }

    setIsLoading(true);

    try {
      const response = await loginUser(formData.login, formData.password);
      const user = response.data;
      
      // Сохраняем user_id в localStorage для последующих запросов
      localStorage.setItem('userId', user.id.toString());
      localStorage.setItem('user', JSON.stringify(user));
      
      showAlert('Вход выполнен успешно!', 'success');
      
      setTimeout(() => {
        if (onLoginSuccess) {
          onLoginSuccess(user);
        } else {
          window.location.reload();
        }
      }, 1500);

    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Не удалось войти. Проверьте логин и пароль.';
      showAlert(errorMessage, 'error');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout title="Вход">
      <div className={styles.page}>
        <div className={styles.loginContainer}>
          <p className={styles.subtitle}>
            Войдите в систему, используя ваш логин и пароль
          </p>
          <form onSubmit={handleSubmit} className={styles.form}>
            <input 
              name="login" 
              type="text" 
              value={formData.login} 
              onChange={handleChange} 
              placeholder="Логин" 
              className={styles.input}
              autoComplete="username"
            />
            {errors.login && <p className={styles.error}>{errors.login}</p>}

            <input 
              name="password" 
              type="password" 
              value={formData.password} 
              onChange={handleChange} 
              placeholder="Пароль" 
              className={styles.input}
              autoComplete="current-password"
            />
            {errors.password && <p className={styles.error}>{errors.password}</p>}

            <button type="submit" disabled={isLoading} className={styles.submitButton}>
              {isLoading ? 'Вход...' : 'Войти'}
            </button>
          </form>
          <div className={styles.registerLink}>
            <p>Нет аккаунта? <button type="button" onClick={() => onShowRegistration && onShowRegistration()} className={styles.linkButton}>Зарегистрироваться</button></p>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

export default LoginPage;
