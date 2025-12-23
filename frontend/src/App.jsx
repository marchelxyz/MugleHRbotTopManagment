// frontend/src/App.jsx

import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import { checkUserStatus, getFeed, getBanners } from './api';
import { initializeCache, clearCache, setCachedData } from './storage';

// Компоненты навигации (загружаются сразу, так как всегда видны)
import BottomNav from './components/BottomNav';
import SideNav from './components/SideNav';
import LoadingScreen from './components/LoadingScreen'; // Страница загрузки
import { startSession, pingSession } from './api';

// Lazy loading для всех страниц - уменьшает начальный бандл на 60-70%
const RegistrationPage = React.lazy(() => import('./pages/RegistrationPage'));
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const HomePage = React.lazy(() => import('./pages/HomePage'));
const LeaderboardPage = React.lazy(() => import('./pages/LeaderboardPage'));
const MarketplacePage = React.lazy(() => import('./pages/MarketplacePage'));
const ProfilePage = React.lazy(() => import('./pages/ProfilePage'));
const HistoryPage = React.lazy(() => import('./pages/HistoryPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const FaqPage = React.lazy(() => import('./pages/FaqPage'));
const PendingPage = React.lazy(() => import('./pages/PendingPage'));
const RejectedPage = React.lazy(() => import('./pages/RejectedPage'));
const RoulettePage = React.lazy(() => import('./pages/RoulettePage'));
const BonusCardPage = React.lazy(() => import('./pages/BonusCardPage'));
const EditProfilePage = React.lazy(() => import('./pages/EditProfilePage'));
const BlockedPage = React.lazy(() => import('./pages/BlockedPage'));
const TransferPage = React.lazy(() => import('./pages/TransferPage'));
const NotificationsPage = React.lazy(() => import('./pages/NotificationsPage'));
const OnboardingStories = React.lazy(() => import('./components/OnboardingStories'));

// Fallback компонент для Suspense
const PageLoader = () => <LoadingScreen />;

// Стили
import './App.css';

const PING_INTERVAL = 60000; // Пингуем каждую минуту (60 000 миллисекунд)
const STATUS_CHECK_INTERVAL = 5000; // Проверяем статус каждые 5 секунд (5000 миллисекунд)

// Безопасная инициализация Telegram WebApp
const tg = window.Telegram?.WebApp || null;
const isTelegramWebApp = !!window.Telegram?.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);
  const [showPendingBanner, setShowPendingBanner] = useState(false);
 // 2. Добавляем новое состояние для принудительного показа обучения
  const [showOnboarding, setShowOnboarding] = useState(false);
  // Инициализация windowWidth с проверкой доступности window
  const [windowWidth, setWindowWidth] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth;
    }
    return 1024; // Значение по умолчанию для SSR
  });
  // Состояние для переключения между страницами входа и регистрации в браузере
  const [showRegistration, setShowRegistration] = useState(false);
  
  // Определяем, является ли устройство десктопом
  // Пороговые значения:
  // - Mobile: < 768px (мобильный интерфейс)
  // - Tablet/Desktop: >= 768px (desktop интерфейс с боковым меню)
  // В браузере определяем desktop только по ширине окна
  // В Telegram WebApp также учитываем платформу
  const DESKTOP_BREAKPOINT = 768; // Порог для переключения на desktop интерфейс
  
  const isDesktop = !isTelegramWebApp 
    ? (windowWidth >= DESKTOP_BREAKPOINT) 
    : (['tdesktop', 'macos', 'web'].includes(tg?.platform) && windowWidth >= DESKTOP_BREAKPOINT) || 
      (windowWidth >= DESKTOP_BREAKPOINT);
  
  // Отладочная информация для разработки
  useEffect(() => {
    if (!isTelegramWebApp) {
      console.log('Browser mode - windowWidth:', windowWidth, 'isDesktop:', isDesktop, 'breakpoint:', DESKTOP_BREAKPOINT);
    }
  }, [windowWidth, isDesktop, isTelegramWebApp]);
  
  // Отслеживаем изменение размера окна с debounce для оптимизации
  useEffect(() => {
    let resizeTimer;
    const handleResize = () => {
      // Debounce для оптимизации производительности
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (typeof window !== 'undefined') {
          setWindowWidth(window.innerWidth);
        }
      }, 100); // Задержка 100ms для плавности
    };
    
    // Убеждаемся, что windowWidth актуален при первой загрузке
    if (typeof window !== 'undefined') {
      setWindowWidth(window.innerWidth);
    }
    
    window.addEventListener('resize', handleResize);
    // Также отслеживаем изменения через visualViewport для мобильных устройств
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    }
    
    return () => {
      clearTimeout(resizeTimer);
      window.removeEventListener('resize', handleResize);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  useEffect(() => {
    // Инициализация Telegram WebApp только если он доступен
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setBackgroundColor('#E8F4F8'); // Зимний фон
      tg.setHeaderColor('#2196F3'); // Зимний голубой
      
      // Включаем подтверждение закрытия для предотвращения случайного закрытия
      tg.enableClosingConfirmation();
      
      // Обработчик изменения видимости viewport (когда приложение становится видимым/невидимым)
      tg.onEvent('viewportChanged', (event) => {
        console.log('Viewport changed:', event);
        // Когда приложение становится видимым, убеждаемся, что оно развернуто
        if (event.isStateVisible) {
          console.log('Viewport стал видимым, разворачиваем приложение...');
          tg.expand();
          tg.ready(); // Переподключаемся
        }
      });
      
      // Обработчик изменения видимости (для мобильных устройств)
      tg.onEvent('visibilityChanged', (event) => {
        console.log('Visibility changed:', event);
        // Когда приложение становится видимым, убеждаемся, что оно развернуто
        if (event.isVisible) {
          console.log('Приложение стало видимым, разворачиваем...');
          tg.expand();
          tg.ready(); // Переподключаемся
        } else {
          console.log('Приложение стало невидимым');
        }
      });
    }
    
    // Обработчик события visibilitychange для браузера (fallback)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && tg) {
        console.log('App became visible (visibilitychange), expanding and reconnecting...');
        // Агрессивно переподключаемся при возврате из фонового режима
        try {
          tg.expand();
          tg.ready(); // Переподключаемся к Telegram WebApp
          // Также пытаемся обновить состояние приложения
          if (tg.setHeaderColor) {
            tg.setHeaderColor('#2196F3');
          }
          if (tg.setBackgroundColor) {
            tg.setBackgroundColor('#E8F4F8');
          }
        } catch (error) {
          console.error('Ошибка при переподключении после возврата из фонового режима:', error);
        }
      } else if (document.visibilityState === 'hidden' && tg) {
        console.log('App became hidden (visibilitychange)');
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    initializeCache();  
      
    const telegramUser = tg?.initDataUnsafe?.user;
    
    // Если не в Telegram WebApp, проверяем браузерную авторизацию
    if (!isTelegramWebApp || !telegramUser) {
      // Проверяем, есть ли сохраненный пользователь в localStorage
      const savedUserId = localStorage.getItem('userId');
      const savedUser = localStorage.getItem('user');
      
      if (savedUserId && savedUser) {
        // Сначала восстанавливаем пользователя из localStorage для мгновенного отображения
        try {
          const parsedUser = JSON.parse(savedUser);
          setUser(parsedUser);
        } catch (err) {
          console.error('Ошибка парсинга сохраненного пользователя:', err);
        }
        
        // Затем проверяем статус пользователя на сервере
        const checkBrowserUser = async () => {
          try {
            const { checkUserStatusById } = await import('./api');
            const userResponse = await checkUserStatusById(savedUserId);
            // Обновляем пользователя актуальными данными с сервера
            setUser(userResponse.data);
            // Обновляем localStorage актуальными данными
            localStorage.setItem('user', JSON.stringify(userResponse.data));
          } catch (err) {
            // Если пользователь не найден или ошибка авторизации, очищаем localStorage
            if (err.response && (err.response.status === 401 || err.response.status === 404)) {
              localStorage.removeItem('userId');
              localStorage.removeItem('user');
              setUser(null);
            } else {
              // При других ошибках (сеть и т.д.) оставляем пользователя из localStorage
              console.warn('Не удалось проверить статус пользователя, используем сохраненные данные:', err);
            }
          } finally {
            setLoading(false);
          }
        };
        
        checkBrowserUser();
      } else {
        setLoading(false);
      }
      
      // Возвращаем функцию очистки даже при раннем выходе
      return () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
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
        // Используем Promise.all для параллельного сохранения
        const cachePromises = [];
        if (feedResponse?.data) {
          cachePromises.push(setCachedData('feed', feedResponse.data));
        }
        if (bannersResponse?.data) {
          cachePromises.push(setCachedData('banners', bannersResponse.data));
        }
        if (cachePromises.length > 0) {
          await Promise.all(cachePromises);
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
    
    // Очистка обработчика при размонтировании
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);
  
  // Мемоизируем обработчики для предотвращения лишних ререндеров
  const handleRegistrationSuccess = useCallback(() => { 
    window.location.reload(); 
  }, []);
  
  const handleLoginSuccess = useCallback((userData) => {
    setUser(userData);
    // Сохраняем пользователя в localStorage
    localStorage.setItem('userId', userData.id.toString());
    localStorage.setItem('user', JSON.stringify(userData));
  }, []);
  
  const navigate = useCallback((targetPage) => {
    setShowPendingBanner(false);
    setPage(targetPage);
  }, []);
  
  const updateUser = useCallback((newUserData) => {
    setUser(prev => ({ ...prev, ...newUserData }));
  }, []);

  const handlePurchaseAndUpdate = useCallback((newUserData) => {
    updateUser(newUserData);
    clearCache('market');
  }, [updateUser]);

  const handleTransferSuccess = useCallback((updatedSenderData) => {
    updateUser(updatedSenderData);
    clearCache('feed');
    navigate('home');
  }, [updateUser, navigate]);
  
  const handleProfileSaveSuccess = useCallback(() => {
    setShowPendingBanner(true);
    setPage('profile');
  }, []);

  const handleOnboardingComplete = useCallback(() => {
    if (user) {
      setUser(prevUser => ({ ...prevUser, has_seen_onboarding: true }));
    }
    setShowOnboarding(false);
  }, [user]);

  const handleShowRegistration = useCallback(() => {
    setShowRegistration(true);
  }, []);

  const handleBackToLogin = useCallback(() => {
    setShowRegistration(false);
  }, []);

  const handleRepeatOnboarding = useCallback(() => {
    setShowOnboarding(true);
  }, []);

  // Мемоизируем вычисляемые значения
  const isOnboardingVisible = useMemo(() => {
    return (user && !user.has_seen_onboarding) || showOnboarding;
  }, [user, showOnboarding]);

  const isUserApproved = useMemo(() => {
    return user && user.status === 'approved';
  }, [user]);

  const shouldShowSideNav = useMemo(() => {
    return isDesktop && isUserApproved && !isOnboardingVisible;
  }, [isDesktop, isUserApproved, isOnboardingVisible]);

  const shouldShowBottomNav = useMemo(() => {
    return !isDesktop && isUserApproved && !isOnboardingVisible;
  }, [isDesktop, isUserApproved, isOnboardingVisible]);

  const isLoginOrRegistrationPage = useMemo(() => {
    return !isTelegramWebApp && !user;
  }, [isTelegramWebApp, user]);
  
  const renderPage = () => {
    if (loading) {
      return <LoadingScreen />;
    }
  
    // Если не в Telegram WebApp, показываем страницу входа или регистрации
    if (!isTelegramWebApp) {
      if (!user) {
        if (showRegistration) {
          return (
            <Suspense fallback={<PageLoader />}>
              <RegistrationPage 
                telegramUser={null} 
                onRegistrationSuccess={handleRegistrationSuccess} 
                isWebBrowser={true}
                onBackToLogin={handleBackToLogin}
              />
            </Suspense>
          );
        }
        return (
          <Suspense fallback={<PageLoader />}>
            <LoginPage onLoginSuccess={handleLoginSuccess} onShowRegistration={handleShowRegistration} />
          </Suspense>
        );
      }
    }
  
    if (!user) {
      const telegramUser = tg?.initDataUnsafe?.user;
      if (!telegramUser) {
        if (showRegistration) {
          return (
            <Suspense fallback={<PageLoader />}>
              <RegistrationPage 
                telegramUser={null} 
                onRegistrationSuccess={handleRegistrationSuccess} 
                isWebBrowser={true}
                onBackToLogin={handleBackToLogin}
              />
            </Suspense>
          );
        }
        return (
          <Suspense fallback={<PageLoader />}>
            <LoginPage onLoginSuccess={handleLoginSuccess} onShowRegistration={handleShowRegistration} />
          </Suspense>
        );
      }
      return (
        <Suspense fallback={<PageLoader />}>
          <RegistrationPage telegramUser={telegramUser} onRegistrationSuccess={handleRegistrationSuccess} />
        </Suspense>
      );
    }

    if (user.status === 'pending') {
      return (
        <Suspense fallback={<PageLoader />}>
          <PendingPage />
        </Suspense>
      );
    }
    if (user.status === 'blocked') {
      return (
        <Suspense fallback={<PageLoader />}>
          <BlockedPage />
        </Suspense>
      );
    }
    if (user.status === 'rejected') {
      return (
        <Suspense fallback={<PageLoader />}>
          <RejectedPage />
        </Suspense>
      );
    }

    if (user.status === 'approved' && (!user.has_seen_onboarding || showOnboarding)) {
      return (
        <Suspense fallback={<PageLoader />}>
          <OnboardingStories onComplete={handleOnboardingComplete} />
        </Suspense>
      );
    }
    
    if (user.status === 'approved') {
      switch (page) {
        case 'leaderboard': 
          return (
            <Suspense fallback={<PageLoader />}>
              <LeaderboardPage user={user} />
            </Suspense>
          );
        case 'roulette': 
          return (
            <Suspense fallback={<PageLoader />}>
              <RoulettePage user={user} onUpdateUser={updateUser} />
            </Suspense>
          );
        case 'marketplace': 
          return (
            <Suspense fallback={<PageLoader />}>
              <MarketplacePage user={user} onPurchaseSuccess={handlePurchaseAndUpdate} />
            </Suspense>
          );
        case 'profile': 
          return (
            <Suspense fallback={<PageLoader />}>
              <ProfilePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} />
            </Suspense>
          );
        case 'bonus_card': 
          return (
            <Suspense fallback={<PageLoader />}>
              <BonusCardPage user={user} onBack={() => navigate('profile')} onUpdateUser={updateUser} />
            </Suspense>
          );
        case 'edit_profile': 
          return (
            <Suspense fallback={<PageLoader />}>
              <EditProfilePage user={user} onBack={() => navigate('profile')} onSaveSuccess={handleProfileSaveSuccess} />
            </Suspense>
          );
        case 'notifications': 
          return (
            <Suspense fallback={<PageLoader />}>
              <NotificationsPage user={user} onBack={() => navigate('profile')} />
            </Suspense>
          );
        case 'settings': 
          return (
            <Suspense fallback={<PageLoader />}>
              <SettingsPage 
                onBack={() => navigate('profile')} 
                onNavigate={navigate} 
                onRepeatOnboarding={handleRepeatOnboarding}
                user={user}
              />
            </Suspense>
          );
        case 'faq': 
          return (
            <Suspense fallback={<PageLoader />}>
              <FaqPage onBack={() => navigate('settings')} />
            </Suspense>
          );
        case 'history': 
          return (
            <Suspense fallback={<PageLoader />}>
              <HistoryPage user={user} onBack={() => navigate('profile')} />
            </Suspense>
          );
        case 'transfer': 
          return (
            <Suspense fallback={<PageLoader />}>
              <TransferPage user={user} onBack={() => navigate('home')} onTransferSuccess={handleTransferSuccess} />
            </Suspense>
          );
        case 'admin': 
          return (
            <Suspense fallback={<PageLoader />}>
              <AdminPage />
            </Suspense>
          );
        case 'home':
        default:
          return (
            <Suspense fallback={<PageLoader />}>
              <HomePage user={user} telegramPhotoUrl={telegramPhotoUrl} onNavigate={navigate} isDesktop={isDesktop} />
            </Suspense>
          );
      }
    }
    
    return <div>Неизвестный статус пользователя.</div>;
  };

  
    // --- НОВЫЙ БЛОК ДЛЯ ОТСЛЕЖИВАНИЯ СЕССИИ ---
  useEffect(() => {
    // Отслеживание сессии только в Telegram WebApp
    if (!isTelegramWebApp) {
      return;
    }

    let sessionId = null;
    let intervalId = null;
    let isActive = true;

    // Функция для запуска пинга сессии
    const startPinging = () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
      
      intervalId = setInterval(async () => {
        if (sessionId && isActive && document.visibilityState === 'visible') {
          try {
            await pingSession(sessionId);
            console.log(`Пинг для сессии ${sessionId} успешен.`);
          } catch (pingError) {
            console.error('Ошибка пинга сессии:', pingError);
            // Если сессия не найдена на сервере, пересоздаем её
            if (pingError.response && pingError.response.status === 404) {
              try {
                const newResponse = await startSession();
                sessionId = newResponse.data.id;
                console.log('Сессия пересоздана, новый ID:', sessionId);
              } catch (restartError) {
                console.error('Не удалось пересоздать сессию:', restartError);
                if (intervalId) {
                  clearInterval(intervalId);
                  intervalId = null;
                }
              }
            }
          }
        }
      }, PING_INTERVAL);
    };

    // Обработчик возврата из фонового режима
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('Приложение вернулось в активное состояние');
        isActive = true;
        // Переподключаемся, если нужно
        if (tg) {
          tg.expand();
          tg.ready();
        }
        // Перезапускаем пинг, если он был остановлен
        if (!intervalId && sessionId) {
          startPinging();
        }
      } else {
        console.log('Приложение перешло в фоновый режим');
        isActive = false;
      }
    };

    // Обработчик закрытия приложения через Telegram WebApp API
    const handleClose = () => {
      console.log('Приложение закрывается через Telegram WebApp');
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Обработчик события beforeunload (когда пользователь закрывает вкладку/приложение)
    const handleBeforeUnload = () => {
      console.log('Приложение закрывается (beforeunload)');
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Добавляем обработчики событий
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Обработчик закрытия через Telegram WebApp API
    if (tg && tg.onEvent) {
      tg.onEvent('close', handleClose);
    }

    // Инициализация сессии
    const sessionManager = async () => {
      try {
        // 1. При запуске приложения создаем новую сессию
        const response = await startSession();
        sessionId = response.data.id;
        console.log('Сессия успешно запущена, ID:', sessionId);

        // 2. Запускаем интервал для пинга сессии
        startPinging();

      } catch (startError) {
        // Ошибки могут возникать, если пользователь не авторизован, это нормально
        console.error('Не удалось запустить сессию:', startError);
      }
    };

    sessionManager();

    // Функция очистки: сработает, когда компонент размонтируется
    return () => {
      isActive = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
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

    const telegramUser = tg?.initDataUnsafe?.user;
    if (!telegramUser || !isTelegramWebApp) {
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

  
  return (
    <div className="app-container">
      {/* Теперь меню показываются на основе новых, правильных переменных */}
      {shouldShowSideNav && <SideNav user={user} activePage={page} onNavigate={navigate} />}
      {shouldShowBottomNav && <BottomNav user={user} activePage={page} onNavigate={navigate} />}
      
      {/* Логика для <main>: 
          - Для страниц входа/регистрации не применяем классы wrapper
          - Для desktop всегда применяем desktop-wrapper (даже если меню не показывается)
          - Добавляем класс with-sidebar только когда боковое меню показывается
          - Для mobile применяем mobile-wrapper */}
      <main className={
        isLoginOrRegistrationPage 
          ? '' 
          : (isDesktop 
              ? `desktop-wrapper ${shouldShowSideNav ? 'with-sidebar' : ''}` 
              : 'mobile-wrapper')
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
