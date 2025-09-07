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
import PendingPage from './pages/PendingPage';
import RejectedPage from './pages/RejectedPage';
import RoulettePage from './pages/RoulettePage';
import BonusCardPage from './pages/BonusCardPage';
import EditProfilePage from './pages/EditProfilePage';
// --- 1. ИМПОРТИРУЕМ ИКОНКИ ДЛЯ ПРАВОЙ ПАНЕЛИ ---
import { FaChevronDown, FaBars } from 'react-icons/fa';
// Стили
import './App.css';

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);
  const [showPendingBanner, setShowPendingBanner] = useState(false);

  useEffect(() => {
    tg.ready();

// --- НАЧАЛО ИЗМЕНЕНИЙ ---
    // 1. Команда развернуть приложение на весь экран
    tg.expand();
    
    // 2. Устанавливаем цвет фона для системной области за пределами нашего приложения
    tg.setBackgroundColor('#F4F4F8'); // Наш светло-серый фон
    
    // 3. Устанавливаем цвет верхней шапки, чтобы она сливалась с нашим дизайном
    tg.setHeaderColor('#408200'); // Наш темно-зеленый цвет
    // --- КОНЕЦ ИЗМЕНЕНИЙ ---
    
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

  // --- ИСПРАВЛЕНИЕ: Возвращаем простую перезагрузку ---
  const handleRegistrationSuccess = () => {
    // Эта функция теперь снова просто перезагружает страницу.
    // После перезагрузки useEffect снова выполнится и получит
    // пользователя уже с новым статусом 'pending'.
    window.location.reload();
  };
  
  // --- 3. ОБНОВЛЯЕМ НАВИГАЦИЮ, ЧТОБЫ ОНА СКРЫВАЛА ПЛАШКУ ---
  const navigate = (targetPage) => {
    setShowPendingBanner(false); // Скрываем плашку при любом переходе
    setPage(targetPage);
  };
  
  const updateUser = (newUserData) => setUser(prev => ({ ...prev, ...newUserData }));
  const handlePurchaseAndUpdate = (newUserData) => {
    updateUser(newUserData);
    // clearCache('market'); // Логику кэша пока уберем для упрощения
  };
  const handleTransferSuccess = () => {
    // clearCache('feed'); // Логику кэша пока уберем для упрощения
    navigate('home');
  };

  // --- 4. НОВЫЙ ОБРАБОТЧИК ДЛЯ УСПЕШНОГО ЗАПРОСА НА РЕДАКТИРОВАНИЕ ---
  const handleProfileSaveSuccess = () => {
      // Показываем плашку
      setShowPendingBanner(true);
      // Возвращаем пользователя в профиль
      setPage('profile');
  };
  
  const renderPage = () => {
    if (loading) {
      return <div>Загрузка...</div>;
    }
    
    if (!user) {
      return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
    }
    
    if (user.status === 'pending') {
      return <PendingPage />;
    }
    
    if (user.status === 'rejected') {
      return <RejectedPage />;
    }
    
    if (user.status === 'approved') {
      switch (page) {
        case 'leaderboard': return <LeaderboardPage />;
        case 'roulette': // 2. Добавляем новый case
        return <RoulettePage user={user} onUpdateUser={updateUser} />;
        case 'marketplace': return <MarketplacePage user={user} onPurchaseSuccess={handlePurchaseAndUpdate} />;
        case 'profile': return <ProfilePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />;
        case 'bonus_card': return <BonusCardPage user={user} onBack={() => navigate('profile')} onUpdateUser={updateUser} />;
        // --- 5. ДОБАВЛЯЕМ НОВЫЙ "CASE" ДЛЯ СТРАНИЦЫ РЕДАКТИРОВАНИЯ ---
        case 'edit_profile': 
          return <EditProfilePage 
                    user={user} 
                    onBack={() => navigate('profile')} 
                    onSaveSuccess={handleProfileSaveSuccess} // Передаем новый обработчик
                 />;
                 
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
    
    return <div>Неизвестный статус пользователя.</div>;
  };

  return (
    <div className="app-wrapper">

      {/* --- 6. ДОБАВЛЯЕМ САМУ ПЛАШКУ (УВЕДОМЛЕНИЕ) --- */}
      {showPendingBanner && (
          <div className="pending-update-banner">
              ⏳ Ваши изменения отправлены на согласование администраторам.
          </div>
      )}

      {renderPage()}
      {user && user.status === 'approved' && <BottomNav user={user} activePage={page} onNavigate={navigate} />}
    </div>
  );
}

export default App;
