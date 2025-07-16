import React, { useState, useEffect } from 'react';
import { checkUserStatus } from './api';
import RegistrationPage from './RegistrationPage';
import HomePage from './HomePage';
import TransferPage from './TransferPage'; // Импортируем новую страницу

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState('home'); // Новое состояние для навигации

  // ... (useEffect и handleRegistrationSuccess остаются без изменений) ...
  useEffect(() => {
    tg.ready();
    const telegramUser = tg.initDataUnsafe?.user;
    if (!telegramUser) {
      setError('Не удалось получить данные Telegram. Откройте приложение через бота.');
      setLoading(false);
      return;
    }
    const fetchUser = async () => {
      try {
        const response = await checkUserStatus(telegramUser.id);
        setUser(response.data);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.log('Пользователь не зарегистрирован, показываем форму регистрации.');
        } else {
          setError('Не удалось связаться с сервером.');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  const handleRegistrationSuccess = () => {
    setLoading(true);
    setTimeout(() => window.location.reload(), 1000);
  };

  const navigate = (targetPage) => {
    setPage(targetPage);
  };

  // ----- Обновленный Рендеринг -----

  if (loading) {
    return <div>Загрузка...</div>;
  }
  if (error) {
    return <div>Ошибка: {error}</div>;
  }

  // Если пользователь не зарегистрирован, показываем регистрацию
  if (!user) {
    if (tg.initDataUnsafe?.user) {
      return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
    }
    // На всякий случай
    return <div>Что-то пошло не так. Пожалуйста, перезапустите приложение.</div>;
  }

  // Если пользователь зарегистрирован, решаем какую страницу показать
  switch (page) {
    case 'transfer':
      return <TransferPage onBack={() => navigate('home')} />;
    case 'home':
    default:
      return <HomePage user={user} onNavigate={navigate} />;
  }
}

export default App;
