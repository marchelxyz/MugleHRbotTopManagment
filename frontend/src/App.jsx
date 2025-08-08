// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import { checkUserStatus } from './api';

// Компоненты и страницы
import BottomNav from './components/BottomNav';
import RegistrationPage from './pages/RegistrationPage';
import HomePage from './pages/HomePage';
import TransferPage from './pages/TransferPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MarketplacePage from './pages/MarketplacePage';
import ProfilePage from './pages/ProfilePage';
import HistoryPage from './pages/HistoryPage'; // Импортируем новую страницу
import AdminPage from './pages/AdminPage';

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);

  useEffect(() => {
    tg.ready();
    const telegramUser = tg.initDataUnsafe?.user;

    if (!telegramUser) {
      setError('Не удалось получить данные Telegram. Откройте приложение через бота.');
      setLoading(false);
      return;
    }

   // 2. Сохраняем URL фото, если он есть
       if (telegramUser.photo_url) {
      setTelegramPhotoUrl(telegramUser.photo_url);
    }

    const fetchUser = async () => {
      try {
        const response = await checkUserStatus(telegramUser.id);
        setUser(response.data);
      } catch (err) {
        if (err.response && err.response.status === 404) {
          console.log('Пользователь не зарегистрирован, показываем форму регистрации.');
        } else {
          setError('Не удалось связаться с сервером. Попробуйте позже.');
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []);

  const handleRegistrationSuccess = () => window.location.reload();
  const navigate = (targetPage) => setPage(targetPage);

  const renderPage = () => {
    // Если пользователь не зарегистрирован, всегда показываем регистрацию
    if (!user) {
      // Показываем заглушку, пока идет проверка пользователя
      if (loading) return <div>Загрузка...</div>;
      
      // Если пользователь не найден, показываем регистрацию
      if (tg.initDataUnsafe?.user) {
        return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
      }
      
      // На случай, если что-то пошло не так
      return <div>Что-то пошло не так. Пожалуйста, перезапустите приложение.</div>;
    }
    
    // В зависимости от значения `page` показываем нужный компонент
    switch (page) {
      case 'leaderboard':
        return <LeaderboardPage />;
      case 'marketplace':
        return <MarketplacePage user={user} />;
      case 'profile':
        return <ProfilePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
      case 'history': // Наша новая страница
        return <HistoryPage user={user} onBack={() => navigate('profile')} />;
      case 'transfer':
        return <TransferPage user={user} onBack={() => navigate('home')} />;
      case 'home':
      default:
        // 3. Передаем URL фото в HomePage
        return <HomePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
        return <HomePage user={user} onNavigate={navigate} />;
      case 'admin': // <-- Добавляем case для админ-страницы
        return <AdminPage />;
      case 'home':
    }
  };

  if (error) return <div>Ошибка: {error}</div>;

return (
    <div style={{ paddingBottom: '70px' }}>
      {renderPage()}
      {/* Передаем user в BottomNav */}
      {user && <BottomNav user={user} activePage={page} onNavigate={navigate} />}
    </div>
  );
}

export default App;
