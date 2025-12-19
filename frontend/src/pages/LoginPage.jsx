// frontend/src/pages/LoginPage.jsx

import React, { useState } from 'react';
import { loginUser } from '../api';
import styles from './LoginPage.module.css';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

function LoginPage({ onLoginSuccess, onShowRegistration }) {
  const { showAlert } = useModalAlert();
  const [formData, setFormData] = useState({
    login: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordData, setForgotPasswordData] = useState({
    fio: '',
    phone: '',
    department: '',
    position: '',
    balance: ''
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleForgotPasswordChange = (e) => {
    const { name, value } = e.target;
    setForgotPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handleForgotPasswordSubmit = (e) => {
    e.preventDefault();
    const subject = encodeURIComponent('Восстановление логина и пароля в Спасибо');
    const body = encodeURIComponent(
      `ФИО: ${forgotPasswordData.fio}\n` +
      `Номер телефона: ${forgotPasswordData.phone}\n` +
      `Подразделение: ${forgotPasswordData.department}\n` +
      `Должность: ${forgotPasswordData.position}\n` +
      `Примерное количество спасибок на балансе: ${forgotPasswordData.balance}`
    );
    window.location.href = `mailto:masovroma@gmail.com?subject=${subject}&body=${body}`;
  };

  const handleRegisterClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onShowRegistration) {
      onShowRegistration();
    }
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

          <div className={styles.passwordContainer}>
            <input 
              name="password" 
              type={showPassword ? "text" : "password"} 
              value={formData.password} 
              onChange={handleChange} 
              placeholder="Пароль" 
              className={styles.input}
              autoComplete="current-password"
            />
            <button
              type="button"
              className={styles.eyeButton}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
            >
              {showPassword ? <FaEyeSlash /> : <FaEye />}
            </button>
          </div>
          {errors.password && <p className={styles.error}>{errors.password}</p>}

          <div className={styles.forgotPasswordLink}>
            <button 
              type="button" 
              onClick={() => setShowForgotPassword(true)} 
              className={styles.forgotPasswordButton}
            >
              Забыли пароль?
            </button>
          </div>

          <button type="submit" disabled={isLoading} className={styles.submitButton}>
            {isLoading ? 'Вход...' : 'Войти'}
          </button>
        </form>
        <div className={styles.registerLink}>
          <p>Нет аккаунта? <button type="button" onClick={handleRegisterClick} className={styles.linkButton}>Зарегистрироваться</button></p>
        </div>
      </div>

      {showForgotPassword && (
        <div className={styles.forgotPasswordModal}>
          <div className={styles.forgotPasswordContent}>
            <h2>Восстановление доступа</h2>
            <p className={styles.forgotPasswordText}>
              Заполните форму ниже, и мы откроем почтовый клиент для отправки запроса на восстановление доступа.
            </p>
            <form onSubmit={handleForgotPasswordSubmit}>
              <input
                name="fio"
                type="text"
                value={forgotPasswordData.fio}
                onChange={handleForgotPasswordChange}
                placeholder="ФИО"
                className={styles.input}
                required
              />
              <input
                name="phone"
                type="tel"
                value={forgotPasswordData.phone}
                onChange={handleForgotPasswordChange}
                placeholder="Номер телефона"
                className={styles.input}
                required
              />
              <input
                name="department"
                type="text"
                value={forgotPasswordData.department}
                onChange={handleForgotPasswordChange}
                placeholder="Подразделение"
                className={styles.input}
                required
              />
              <input
                name="position"
                type="text"
                value={forgotPasswordData.position}
                onChange={handleForgotPasswordChange}
                placeholder="Должность"
                className={styles.input}
                required
              />
              <input
                name="balance"
                type="text"
                value={forgotPasswordData.balance}
                onChange={handleForgotPasswordChange}
                placeholder="Примерное количество спасибок на балансе"
                className={styles.input}
                required
              />
              <div className={styles.forgotPasswordButtons}>
                <button type="submit" className={styles.submitButton}>
                  Открыть почту
                </button>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowForgotPassword(false);
                    setForgotPasswordData({
                      fio: '',
                      phone: '',
                      department: '',
                      position: '',
                      balance: ''
                    });
                  }} 
                  className={styles.cancelButton}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
