// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import { checkUserStatus } from './api';
import { initializeCache, clearCache } from './storage';

// Компоненты и страницы
import BottomNav from './components/BottomNav';
import SideNav from './components/SideNav'; // 1. Импортируем новое боковое меню
import RegistrationPage from './pages/RegistrationPage';
import HomePage from './pages/HomePage';
import LeaderboardPage from './pages/LeaderboardPage';
import MarketplacePage from './pages/MarketplacePage';
import ProfilePage from './pages/ProfilePage';
import HistoryPage from './pages/HistoryPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import FaqPage from './pages/FaqPage';
import PendingPage from './pages/PendingPage';
import RejectedPage from './pages/RejectedPage';
import RoulettePage from './pages/RoulettePage';
import BonusCardPage from './pages/BonusCardPage';
import EditProfilePage from './pages/EditProfilePage';
import BlockedPage from './pages/BlockedPage';

// Стили
import './App.css';

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);
  const [showPendingBanner, setShowPendingBanner] = useState(false);

  // Эта проверка остается - она ключ к адаптивности
  const isDesktop = ['tdesktop', 'macos', 'web'].includes(tg.platform);

  useEffect(() => {
    tg.ready();
    tg.expand();
    tg.setBackgroundColor('#F4F4F8');
    tg.setHeaderColor('#408200');
    
    initializeCache(); 
     
    const telegramUser = tg.initDataUnsafe?.user;
    if (!telegramUser) {
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
          console.error(err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, []); // Убрали isDesktop из зависимостей, чтобы useEffect не перезапускался

  const handleRegistrationSuccess = () => { window.location.reload(); };
  
  const navigate = (targetPage) => {
    setShowPendingBanner(false);
    setPage(targetPage);
  };
  
  const updateUser = (newUserData) => setUser(prev => ({ ...prev, ...newUserData }));

  const handlePurchaseAndUpdate = (newUserData) => {
    updateUser(newUserData);
    clearCache('market');
  };
  const handleTransferSuccess = () => {
    clearCache('feed');
    navigate('home');
  };

  const handleProfileSaveSuccess = () => {
      setShowPendingBanner(true);
      setPage('profile');
  };
  
  // Эта функция остается без изменений, она рендерит нужную страницу
  const renderPage = () => {
    if (loading) {
      return <div>Загрузка...</div>;
    }
    
    if (!user) {
      return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
    }
    
    if (user.status === 'blocked') { return <BlockedPage />; }
    if (user.status === 'pending') { return <PendingPage />; }
    if (user.status === 'rejected') { return <RejectedPage />; }
    
    if (user.status === 'approved') {
      switch (page) {
        case 'leaderboard': return <LeaderboardPage user={user} />;
        case 'roulette': return <RoulettePage user={user} onUpdateUser={updateUser} />;
        case 'marketplace': return <MarketplacePage user={user} onPurchaseSuccess={handlePurchaseAndUpdate} />;
        case 'profile': return <ProfilePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
        case 'bonus_card': return <BonusCardPage user={user} onBack={() => navigate('profile')} onUpdateUser={updateUser} />;
        case 'edit_profile': return <EditProfilePage user={user} onBack={() => navigate('profile')} onSaveSuccess={handleProfileSaveSuccess} />;
        case 'settings': return <SettingsPage onBack={() => navigate('profile')} onNavigate={navigate} />;
        case 'faq': return <FaqPage onBack={() => navigate('settings')} />;
        case 'history': return <HistoryPage user={user} onBack={() => navigate('profile')} />;
        case 'transfer': return <TransferPage user={user} onBack={() => navigate('home')} onTransferSuccess={handleTransferSuccess} />;
        case 'admin': return <AdminPage />;
        case 'home':
        default:
          // --- ИЗМЕНЕНИЕ ЗДЕСЬ: Передаём isDesktop в HomePage ---
          return <HomePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} isDesktop={isDesktop} />;
      }
    }
    
    return <div>Неизвестный статус пользователя.</div>;
  };

  // --- 2. ГЛАВНОЕ ИЗМЕНЕНИЕ: Новый макет с проверкой isDesktop ---
  return (
    <div className="app-container">
      {/* Показываем навигацию, только если пользователь авторизован */}
      {user && user.status === 'approved' && (
        isDesktop 
          // Если это десктоп - показываем боковое меню
          ? <SideNav user={user} activePage={page} onNavigate={navigate} />
          // Если мобильное устройство - показываем нижнее меню
          : <BottomNav user={user} activePage={page} onNavigate={navigate} />
      )}
      
      {/* Применяем нужный стиль к основному контенту */}
      <main className={isDesktop ? 'desktop-wrapper' : 'mobile-wrapper'}>
        {showPendingBanner && (
            <div className="pending-update-banner">
                ⏳ Ваши изменения отправлены на согласование администраторам.
            </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
}

export default App;
