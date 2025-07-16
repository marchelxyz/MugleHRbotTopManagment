import React, { useState, useEffect } from 'react';
import { checkUserStatus } from './api';
import RegistrationPage from './RegistrationPage';
import HomePage from './HomePage';

// Получаем объект Telegram Web App
const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null); // Данные пользователя с нашего бэкенда
  const [loading, setLoading] = useState(true); // Статус загрузки
  const [error, setError] = useState(false); // Статус ошибки

  useEffect(() => {
    // Убеждаемся, что приложение готово к работе
    tg.ready();
    // Получаем данные пользователя из Telegram
    const telegramUser = tg.initDataUnsafe?.user;

    if (!telegramUser) {
        // Это может случиться, если открывать не из Telegram
      setError('Не удалось получить данные Telegram. Откройте приложение через бота.');
      setLoading(false);
      return;
    }

    const fetchUser = async () => {
      try {
        // Проверяем, зарегистрирован ли пользователь на нашем бэкенде
        const response = await checkUserStatus(telegramUser.id);
        setUser(response.data); // Если да, сохраняем его данные
      } catch (err) {
        // Если бэкенд вернул ошибку 404, значит пользователь не найден.
        // Это ожидаемое поведение для новых пользователей, поэтому не считаем это ошибкой.
        if (err.response && err.response.status === 404) {
          console.log('Пользователь не зарегистрирован, показываем форму регистрации.');
        } else {
          // Другие ошибки (например, бэкенд недоступен) показываем как ошибку
          setError('Не удалось связаться с сервером.');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  // Функция, которую вызовет RegistrationPage после успеха
  const handleRegistrationSuccess = () => {
    setLoading(true); // Включаем загрузку, чтобы перепроверить статус
    // Имитируем перезагрузку данных, чтобы сработал useEffect
    setTimeout(() => window.location.reload(), 1000);
  };
  
  // ----- Рендеринг в зависимости от состояния -----

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (error) {
    return <div>Ошибка: {error}</div>;
  }

  // Если есть данные о пользователе с бэкенда - показываем главный экран
  if (user) {
    return <HomePage user={user} />;
  }

  // Если данных с бэкенда нет, но есть из Telegram - показываем регистрацию
  if (tg.initDataUnsafe?.user) {
    return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
  }

  // На всякий случай, если что-то пошло не так
  return <div>Что-то пошло не так. Пожалуйста, перезапустите приложение.</div>;
}

export default App;
