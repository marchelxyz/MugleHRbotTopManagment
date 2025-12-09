// frontend/src/pages/LoginPage.jsx
import React, { useState } from 'react';
import axios from 'axios';
import { saveToken, saveUser } from '../utils/auth';
import { checkUserStatus } from '../api';
import styles from './LoginPage.module.css';

const API_BASE_URL = import.meta.env.VITE_API_URL;

function LoginPage() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Отправляем запрос на вход
      const response = await axios.post(`${API_BASE_URL}/auth/login`, {
        login,
        password,
      });

      const { access_token, user } = response.data;

      // Сохраняем токен и данные пользователя
      saveToken(access_token);
      saveUser(user);

      // Обновляем данные пользователя через API для получения актуальной информации
      try {
        const userResponse = await checkUserStatus(user.id);
        saveUser(userResponse.data);
      } catch (err) {
        console.warn('Не удалось обновить данные пользователя:', err);
      }

      // Перезагружаем страницу для применения изменений
      window.location.reload();
    } catch (err) {
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Ошибка при входе. Проверьте логин и пароль.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginBox}>
        <h1 className={styles.title}>Вход в систему</h1>
        
        {error && <div className={styles.error}>{error}</div>}
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.inputGroup}>
            <label htmlFor="login">Логин</label>
            <input
              id="login"
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              required
              autoComplete="username"
              disabled={loading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="password">Пароль</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              disabled={loading}
            />
          </div>

          <button 
            type="submit" 
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>

        <div className={styles.footer}>
          <p>
            Нет аккаунта?{' '}
            <a href="/register" style={{ color: '#2196F3', textDecoration: 'none' }}>
              Зарегистрироваться
            </a>
          </p>
          <p style={{ marginTop: '10px' }}>
            <a href="/reset-password" style={{ color: '#2196F3', textDecoration: 'none', fontSize: '14px' }}>
              Забыли пароль?
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
