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
import SettingsPage from './pages/SettingsPage';
import FaqPage from './pages/FaqPage';
// Предзагрузка
import { preloadInitialData, clearCache } from './preloader';
import PendingPage from './pages/PendingPage';
import RejectedPage from './pages/RejectedPage';

// Стили
import './App.css'; 

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

    if (telegramUser.photo_url) {
      setTelegramPhotoUrl(telegramUser.photo_url);
    }

    const fetchUser = async () => {
      try {
        const response = await checkUserStatus(telegramUser.id);
        setUser(response.data);
// --- ИЗМЕНЕНИЕ: Запускаем предзагрузку ПОСЛЕ получения пользователя ---
        preloadInitialData();
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

  const handleTransferSuccess = () => {
    // Очищаем кэш ленты, чтобы при возвращении она обновилась
    clearCache('feed');
    // Возвращаем пользователя на главную
    navigate('home');
  };
  
    // --- ИЗМЕНЕНИЕ: Добавляем эту функцию ---
  // Она будет обновлять баланс и очищать кэш магазина, чтобы при следующем заходе он загрузился заново
  const handlePurchaseAndUpdate = (newUserData) => {
    updateUser(newUserData);
    clearCache('market'); // Очищаем кэш магазина
  }

  const handleRegistrationSuccess = () => window.location.reload();
  const navigate = (targetPage) => setPage(targetPage);

  const updateUser = (newUserData) => {
    setUser(prevUser => ({ ...prevUser, ...newUserData }));
  };
  
  const renderPage = () => {
    if (!user) {
      if (loading) return <div>Загрузка...</div>;
      if (tg.initDataUnsafe?.user) {
        return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
      }
      return <div>Что-то пошло не так. Пожалуйста, перезапустите приложение.</div>;
    }
    // --- НАЧАЛО ИЗМЕНЕНИЙ: Проверяем статус пользователя ---
    if (user.status === 'pending') {
      return <PendingPage />;
    }
    
    if (user.status === 'rejected') {
      return <RejectedPage />;
    }
    
    // Если статус 'approved', показываем приложение как обычно
    if (user.status === 'approved') {
      switch (page) {
        case 'leaderboard': return <LeaderboardPage />;
        case 'marketplace': return <MarketplacePage user={user} onPurchaseSuccess={handlePurchaseAndUpdate} />;
        case 'profile': return <ProfilePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
        case 'settings': return <SettingsPage onBack={() => navigate('profile')} onNavigate={navigate} />;
        case 'faq': return <FaqPage onBack={() => navigate('settings')} />;
        case 'history': return <HistoryPage user={user} onBack={() => navigate('profile')} />;
        case 'transfer': return <TransferPage user={user} onBack={() => navigate('home')} onTransferSuccess={handleTransferSuccess} />;
        case 'admin': return <AdminPage />;
        case 'home':
        default:
          return <HomePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
      }
    }
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
    // На всякий случай, если статус будет каким-то другим
    return <div>Неизвестный статус пользователя.</div>;
  };

  // --- ИЗМЕНЕНИЕ: Не показываем навигацию, если пользователь не одобрен ---
  return (
    <div className="app-wrapper">
      {renderPage()}
      {user && user.status === 'approved' && <BottomNav user={user} activePage={page} onNavigate={navigate} />}
    </div>
  );
}

export default App;
