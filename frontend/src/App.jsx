import React, { useState, useEffect } from 'react';
import { checkUserStatus } from './api';

// Компоненты
import BottomNav from './components/BottomNav';
import RegistrationPage from './pages/RegistrationPage';
import HomePage from './pages/HomePage';
import TransferPage from './pages/TransferPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MarketplacePage from './pages/MarketplacePage';
import ProfilePage from './pages/ProfilePage';

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [page, setPage] = useState('home'); // 'home' - наша главная страница "Лента"

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

  const handleRegistrationSuccess = () => window.location.reload();
  const navigate = (targetPage) => setPage(targetPage);

  const renderPage = () => {
    // Если пользователь не зарегистрирован, всегда показываем регистрацию
    if (!user) {
      if (tg.initDataUnsafe?.user) {
        return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
      }
      return <div>Что-то пошло не так. Пожалуйста, перезапустите приложение.</div>;
    }
    
    // В зависимости от значения `page` показываем нужный компонент
    switch (page) {
      case 'leaderboard':
        return <LeaderboardPage />;
      case 'marketplace':
        return <MarketplacePage />;
      case 'profile':
        return <ProfilePage user={user} />;
      case 'transfer': // Временная страница, не в навигации
        return <TransferPage onBack={() => navigate('home')} />;
      case 'home':
      default:
        return <HomePage user={user} onNavigate={navigate} />;
    }
  };

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div>Ошибка: {error}</div>;

  return (
    <div style={{ paddingBottom: '70px' }}> {/* Добавляем отступ снизу для навигации */}
      {renderPage()}
      {/* Показываем навигацию только если пользователь зарегистрирован */}
      {user && <BottomNav activePage={page} onNavigate={navigate} />}
    </div>
  );
}

export default App;
