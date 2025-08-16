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
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
// Убедитесь, что вы импортировали новые страницы
import SettingsPage from './pages/SettingsPage';
import FaqPage from './pages/FaqPage';
import './App.css';

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);

  useEffect(() => {
    // ... этот хук остается без изменений
    tg.ready();
    const telegramUser = tg.initDataUnsafe?.user;

    if (!telegramUser) {
      setError('Не удалось получить данные Telegram. Откройте приложение через бота.');
      setLoading(false);
      return;
    }

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

  const updateUser = (newUserData) => {
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
  };
  
  // --- НАЧАЛО ИСПРАВЛЕНИЙ ---
  // Заменяем всю функцию renderPage на эту чистую версию
  const renderPage = () => {
    // Если пользователь не зарегистрирован, всегда показываем регистрацию
    if (!user) {
      if (loading) return <div>Загрузка...</div>;
      
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
        return <MarketplacePage user={user} onPurchaseSuccess={updateUser} />;
      case 'profile':
        return <ProfilePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
      case 'settings':
        return <SettingsPage onBack={() => navigate('profile')} onNavigate={navigate} />;
      case 'faq':
        return <FaqPage onBack={() => navigate('settings')} />;
      case 'history':
        return <HistoryPage user={user} onBack={() => navigate('profile')} />;
      case 'transfer':
        return <TransferPage user={user} onBack={() => navigate('home')} />;
      case 'admin':
        return <AdminPage />;
      case 'home':
      default:
        return <HomePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
    }
  };
  // --- КОНЕЦ ИСПРАВЛЕНИЙ ---

  if (error) return <div>Ошибка: {error}</div>;

  return (
     <div className="app-wrapper"> 
      <div style={{ paddingBottom: '70px' }}>
        {renderPage()}
        {user && <BottomNav user={user} activePage={page} onNavigate={navigate} />}
      </div>
    </div>
  );
}

export default App;
