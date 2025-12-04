// frontend/src/pages/PasswordResetPage.jsx

import React, { useState, useEffect } from 'react';
import { requestPasswordReset, resetPassword } from '../api';
import styles from './LoginPage.module.css';

function PasswordResetPage() {
  // Получаем токен из URL параметров
  const getTokenFromUrl = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('token');
  };
  
  const token = getTokenFromUrl();
  
  const [step, setStep] = useState(token ? 'reset' : 'request'); // 'request' или 'reset'
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (token) {
      setStep('reset');
    }
  }, [token]);

  const handleRequestReset = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    if (!email.trim()) {
      setError('Введите email');
      return;
    }

    setLoading(true);
    try {
      await requestPasswordReset(email);
      setSuccess('Инструкции по восстановлению пароля отправлены на ваш email.');
      setEmail('');
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Ошибка при отправке запроса. Попробуйте еще раз.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newPassword || newPassword.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(token, newPassword);
      setSuccess('Пароль успешно изменен! Теперь вы можете войти в систему.');
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    } catch (err) {
      if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Ошибка при сбросе пароля. Возможно, ссылка устарела.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (step === 'reset') {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginBox}>
          <h1 className={styles.title}>Восстановление пароля</h1>
          
          {error && <div className={styles.error}>{error}</div>}
          {success && <div style={{ color: '#4caf50', marginBottom: '15px', textAlign: 'center' }}>{success}</div>}
          
          <form onSubmit={handleResetPassword} className={styles.form}>
            <div className={styles.inputGroup}>
              <label htmlFor="newPassword">Новый пароль *</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                minLength={6}
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="confirmPassword">Подтвердите пароль *</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                disabled={loading}
                minLength={6}
              />
            </div>

            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={loading}
            >
              {loading ? 'Изменение...' : 'Изменить пароль'}
            </button>
          </form>

          <div className={styles.footer}>
            <p>
              <a href="/login" style={{ color: '#2196F3', textDecoration: 'none' }}>
                Вернуться к входу
              </a>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>Восстановление пароля</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        {success && <div style={{ color: '#4caf50', marginBottom: '15px', textAlign: 'center' }}>{success}</div>}
        
        <form onSubmit={handleRequestReset} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              disabled={loading}
              placeholder="Введите ваш email"
            />
            <p style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
              На этот email будет отправлена ссылка для восстановления пароля.
            </p>
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Отправка...' : 'Отправить ссылку'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Вспомнили пароль?{' '}
            <a href="/login" style={{ color: '#2196F3', textDecoration: 'none' }}>
              Войти
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default PasswordResetPage;
