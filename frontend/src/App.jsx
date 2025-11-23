// frontend/src/App.jsx

import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { checkUserStatus, getFeed, getBanners } from './api';
import { initializeCache, clearCache, setCachedData } from './storage';

// Компоненты навигации (используются всегда, загружаем сразу)
import BottomNav from './components/BottomNav';
import SideNav from './components/SideNav';
import LoadingScreen from './components/LoadingScreen'; // Страница загрузки
import { startSession, pingSession } from './api';

// Страницы с lazy loading для оптимизации размера бандла
// Главная страница и регистрация загружаются сразу (критичные)
import HomePage from './pages/HomePage';
import RegistrationPage from './pages/RegistrationPage';

// Остальные страницы загружаются по требованию
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const FaqPage = lazy(() => import('./pages/FaqPage'));
const PendingPage = lazy(() => import('./pages/PendingPage'));
const RejectedPage = lazy(() => import('./pages/RejectedPage'));
const RoulettePage = lazy(() => import('./pages/RoulettePage'));
const BonusCardPage = lazy(() => import('./pages/BonusCardPage'));
const EditProfilePage = lazy(() => import('./pages/EditProfilePage'));
const BlockedPage = lazy(() => import('./pages/BlockedPage'));
const TransferPage = lazy(() => import('./pages/TransferPage'));
const OnboardingStories = lazy(() => import('./components/OnboardingStories'));

// Стили
import './App.css';

const PING_INTERVAL = 60000; // Пингуем каждую минуту (60 000 миллисекунд)
const STATUS_CHECK_INTERVAL = 5000; // Проверяем статус каждые 5 секунд (5000 миллисекунд)

const tg = window.Telegram.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);
  const [showPendingBanner, setShowPendingBanner] = useState(false);
 // 2. Добавляем новое состояние для принудительного показа обучения
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Определяем, является ли устройство десктопом
  // Для планшетов (768px-1024px) будем использовать мобильный интерфейс
  const isDesktop = ['tdesktop', 'macos', 'web'].includes(tg.platform) && windowWidth > 1024;
  
  // Отслеживаем изменение размера окна
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    tg.ready();
    tg.expand();
    tg.setBackgroundColor('#E8F4F8'); // Зимний фон
    tg.setHeaderColor('#2196F3'); // Зимний голубой
    
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
        // Предзагружаем данные для главной страницы параллельно с проверкой пользователя
        const [userResponse, feedResponse, bannersResponse] = await Promise.all([
          checkUserStatus(telegramUser.id),
          getFeed().catch(err => {
            console.warn('Не удалось предзагрузить feed:', err);
            return null;
          }),
          getBanners().catch(err => {
            console.warn('Не удалось предзагрузить banners:', err);
            return null;
          })
        ]);
        
        setUser(userResponse.data);
        
        // Сохраняем предзагруженные данные в кэш для HomePage
        if (feedResponse?.data) {
          setCachedData('feed', feedResponse.data);
        }
        if (bannersResponse?.data) {
          setCachedData('banners', bannersResponse.data);
        }
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

  // --- 1. НОВАЯ ПЕРЕМЕННАЯ ДЛЯ УДОБСТВА ---
  // Эта переменная будет true, если нужно показать обучение, и false в противном случае.
  const isOnboardingVisible = (user && !user.has_seen_onboarding) || showOnboarding;
  
  // Компонент для отображения во время загрузки ленивых компонентов
  const PageLoadingFallback = () => (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '50vh' 
    }}>
      <LoadingScreen />
    </div>
  );

  const renderPage = () => {
    if (loading) {
      return <LoadingScreen />;
    }
  
    if (!user) {
      return <RegistrationPage telegramUser={tg.initDataUnsafe.user} onRegistrationSuccess={handleRegistrationSuccess} />;
    }

    // 4. ГЛАВНАЯ ЛОГИКА: Показываем обучение, если нужно
    // Условие: (флаг в базе false ИЛИ мы включили принудительный показ)
    if (user.status === 'pending') {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <PendingPage />
        </Suspense>
      );
    }
    if (user.status === 'blocked') {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <BlockedPage />
        </Suspense>
      );
    }
    if (user.status === 'rejected') {
      return (
        <Suspense fallback={<PageLoadingFallback />}>
          <RejectedPage />
        </Suspense>
      );
    }

    // 2. Только если пользователь одобрен, проверяем, видел ли он обучение.
    if (user.status === 'approved' && (!user.has_seen_onboarding || showOnboarding)) {
        return (
          <Suspense fallback={<PageLoadingFallback />}>
            <OnboardingStories onComplete={handleOnboardingComplete} />
          </Suspense>
        );
    }
    
    if (user.status === 'approved') {
      switch (page) {
        case 'leaderboard': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <LeaderboardPage user={user} />
            </Suspense>
          );
        case 'roulette': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <RoulettePage user={user} onUpdateUser={updateUser} />
            </Suspense>
          );
        case 'marketplace': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <MarketplacePage user={user} onPurchaseSuccess={handlePurchaseAndUpdate} />
            </Suspense>
          );
        case 'profile': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <ProfilePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />
            </Suspense>
          );
        case 'bonus_card': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <BonusCardPage user={user} onBack={() => navigate('profile')} onUpdateUser={updateUser} />
            </Suspense>
          );
        case 'edit_profile': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <EditProfilePage user={user} onBack={() => navigate('profile')} onSaveSuccess={handleProfileSaveSuccess} />
            </Suspense>
          );
        case 'settings': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <SettingsPage 
                onBack={() => navigate('profile')} 
                onNavigate={navigate} 
                onRepeatOnboarding={() => setShowOnboarding(true)}
              />
            </Suspense>
          );
        case 'faq': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <FaqPage onBack={() => navigate('settings')} />
            </Suspense>
          );
        case 'history': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <HistoryPage user={user} onBack={() => navigate('profile')} />
            </Suspense>
          );
        case 'transfer': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <TransferPage user={user} onBack={() => navigate('home')} onTransferSuccess={handleTransferSuccess} />
            </Suspense>
          );
        case 'admin': 
          return (
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminPage />
            </Suspense>
          );
        case 'home':
        default:
          return <HomePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} isDesktop={isDesktop} />;
      }
    }
    
    return <div>Неизвестный статус пользователя.</div>;
  };

  // 1. Создаем четкие флаги для отображения навигации
  const isUserApproved = user && user.status === 'approved';
  const showSideNav = isDesktop && isUserApproved && !isOnboardingVisible;
  const showBottomNav = !isDesktop && isUserApproved && !isOnboardingVisible;
  
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

  // --- АВТОМАТИЧЕСКАЯ ПРОВЕРКА СТАТУСА ДЛЯ ПОЛЬЗОВАТЕЛЕЙ СО СТАТУСОМ PENDING ---
  const statusCheckIntervalRef = useRef(null);

  useEffect(() => {
    // Проверяем статус только если пользователь существует и его статус 'pending'
    if (!user || user.status !== 'pending') {
      // Очищаем интервал, если статус изменился на не-pending
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
      return;
    }

    const telegramUser = tg.initDataUnsafe?.user;
    if (!telegramUser) {
      return;
    }

    const checkStatus = async () => {
      try {
        const userResponse = await checkUserStatus(telegramUser.id);
        const newUserData = userResponse.data;
        
        // Если статус изменился, обновляем состояние пользователя
        if (newUserData.status !== user.status) {
          console.log(`Статус пользователя изменился с ${user.status} на ${newUserData.status}`);
          setUser(newUserData);
          
          // Если статус изменился на 'approved', останавливаем проверку
          if (newUserData.status === 'approved') {
            if (statusCheckIntervalRef.current) {
              clearInterval(statusCheckIntervalRef.current);
              statusCheckIntervalRef.current = null;
              console.log('Автоматическая проверка статуса остановлена: пользователь одобрен');
            }
          }
        }
      } catch (err) {
        // При ошибке просто логируем, но продолжаем проверку
        console.warn('Ошибка при проверке статуса пользователя:', err);
      }
    };

    // Очищаем предыдущий интервал, если он существует
    if (statusCheckIntervalRef.current) {
      clearInterval(statusCheckIntervalRef.current);
    }

    // Запускаем первую проверку сразу, затем каждые STATUS_CHECK_INTERVAL миллисекунд
    checkStatus();
    statusCheckIntervalRef.current = setInterval(checkStatus, STATUS_CHECK_INTERVAL);

    // Очистка интервала при размонтировании или изменении зависимостей
    return () => {
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
        console.log('Автоматическая проверка статуса остановлена');
      }
    };
  }, [user]); // Зависимость от user, чтобы перезапускать при изменении пользователя

  // Создаем переменные, которые четко определяют, когда показывать меню
  const shouldShowSideNav = user && user.status === 'approved' && isDesktop && !isOnboardingVisible;
  const shouldShowBottomNav = user && user.status === 'approved' && !isDesktop && !isOnboardingVisible;
  
  return (
    <div className="app-container">
      {/* Теперь меню показываются на основе новых, правильных переменных */}
      {shouldShowSideNav && <SideNav user={user} activePage={page} onNavigate={navigate} />}
      {shouldShowBottomNav && <BottomNav user={user} activePage={page} onNavigate={navigate} />}
      
      {/* Логика для <main> остается такой же, как в прошлый раз */}
      <main className={
        isDesktop 
          ? (shouldShowSideNav ? 'desktop-wrapper' : '') 
          : 'mobile-wrapper'
      }>
        {showPendingBanner && (
            <div className="pending-update-banner">
              ⏳ Ваши изменения отправлены на согласование администраторам.
            </div>
        )}
        {renderPage()}
      </main>
    </div>
  );
  // --- КОНЕЦ ИЗМЕНЕНИЙ ---
}

export default App;
