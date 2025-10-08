// frontend/src/App.jsx

import React, { useState, useEffect } from 'react';
import { checkUserStatus } from './api';
import { initializeCache, clearCache } from './storage';

// Компоненты и страницы
import BottomNav from './components/BottomNav';
import SideNav from './components/SideNav';
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
import TransferPage from './pages/TransferPage'; // Убедимся, что TransferPage импортирован
import { startSession, pingSession } from './api';
import OnboardingStories from './components/OnboardingStories'; // 1. Импортируем новый компонент

// Стили
import './App.css';

const PING_INTERVAL = 60000; // Пингуем каждую минуту (60 000 миллисекунд)

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);
  const [showPendingBanner, setShowPendingBanner] = useState(false);
 // 2. Добавляем новое состояние для принудительного показа обучения
  const [showOnboarding, setShowOnboarding] = useState(false);
  
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
  }, []);
  
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

  // --- 1. НОВАЯ ФУНКЦИЯ-ОБРАБОТЧИК ---
const handleTransferSuccess = (updatedSenderData) => {
    updateUser(updatedSenderData); // Обновляем состояние user новыми данными
    clearCache('feed');
    navigate('home');
};
  
  const handleProfileSaveSuccess = () => {
      setShowPendingBanner(true);
      setPage('profile');
  };

  // 3. Создаем функцию-обработчик для завершения обучения
  const handleOnboardingComplete = () => {
    // Обновляем состояние пользователя локально, чтобы не перезагружать все приложение
    if (user) {
      setUser(prevUser => ({ ...prevUser, has_seen_onboarding: true }));
    }
    // Отключаем принудительный показ
    setShowOnboarding(false);
  };
  
  const renderPage = () => {
    if (loading) {
      return <div>Загрузка...</div>;
    }
    
    if (!user) {
      return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
    }

    // 4. ГЛАВНАЯ ЛОГИКА: Показываем обучение, если нужно
    // Условие: (флаг в базе false ИЛИ мы включили принудительный показ)
    if ((user && !user.has_seen_onboarding) || showOnboarding) {
        return <OnboardingStories onComplete={handleOnboardingComplete} />;
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
  case 'settings': 
    return (
      <SettingsPage 
        onBack={() => navigate('profile')} 
        onNavigate={navigate} 
        onRepeatOnboarding={() => setShowOnboarding(true)}
      />
    );
        case 'faq': return <FaqPage onBack={() => navigate('settings')} />;
        case 'history': return <HistoryPage user={user} onBack={() => navigate('profile')} />;
        // --- 2. ГЛАВНОЕ ИЗМЕНЕНИЕ: Передаем новую функцию в TransferPage ---
        case 'transfer': return <TransferPage user={user} onBack={() => navigate('home')} onTransferSuccess={handleTransferSuccess} />;
        case 'admin': return <AdminPage />;
        case 'home':
        default:
          return <HomePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} isDesktop={isDesktop} />;
      }
    }
    
    return <div>Неизвестный статус пользователя.</div>;
  };

    // --- НОВЫЙ БЛОК ДЛЯ ОТСЛЕЖИВАНИЯ СЕССИИ ---
  useEffect(() => {
    let sessionId = null;
    let intervalId = null;

    const sessionManager = async () => {
      try {
        // 1. При запуске приложения создаем новую сессию
        const response = await startSession();
        sessionId = response.data.id;
        console.log('Сессия успешно запущена, ID:', sessionId);

        // 2. Запускаем интервал, который будет "пинговать" сессию
        intervalId = setInterval(async () => {
          if (sessionId) {
            try {
              await pingSession(sessionId);
              console.log(`Пинг для сессии ${sessionId} успешен.`);
            } catch (pingError) {
              console.error('Ошибка пинга сессии:', pingError);
              // Если сессия не найдена на сервере, прекращаем пинговать
              if (pingError.response && pingError.response.status === 404) {
                clearInterval(intervalId);
              }
            }
          }
        }, PING_INTERVAL);

      } catch (startError) {
        // Ошибки могут возникать, если пользователь не авторизован, это нормально
        console.error('Не удалось запустить сессию:', startError);
      }
    };

    sessionManager();

    // 3. Функция очистки: сработает, когда пользователь закроет приложение
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
        console.log('Отслеживание сессии остановлено.');
      }
    };
  }, []); // Пустой массив зависимостей означает, что этот код выполнится только один раз
  
  return (
    <div className="app-container">
      {user && user.status === 'approved' && (
        isDesktop 
          ? <SideNav user={user} activePage={page} onNavigate={navigate} />
          : <BottomNav user={user} activePage={page} onNavigate={navigate} />
      )}
      
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
