// frontend/src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import { checkUserStatus, getFeed, getBanners } from './api';
import { initializeCache, clearCache, setCachedData } from './storage';

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
import TransferPage from './pages/TransferPage'; // Страница отправки спасибок
import { startSession, pingSession } from './api';
import OnboardingStories from './components/OnboardingStories'; // Обучающие истории
import LoadingScreen from './components/LoadingScreen'; // Страница загрузки

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
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Определяем, является ли устройство десктопом
  // Для планшетов (768px-1024px) будем использовать мобильный интерфейс
  const isDesktop = tg ? (['tdesktop', 'macos', 'web'].includes(tg.platform) && windowWidth > 1024) : (windowWidth > 1024);
  
  // Отслеживаем изменение размера окна
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    // Инициализация Telegram WebApp только если он доступен
    let handleVisibilityChange = null;
    
    if (tg) {
      tg.ready();
      tg.expand();
      tg.setBackgroundColor('#E8F4F8'); // Зимний фон
      tg.setHeaderColor('#2196F3'); // Зимний голубой
      
      // Включаем подтверждение закрытия для предотвращения случайного закрытия
      tg.enableClosingConfirmation();
      
      // ✅ ОФИЦИАЛЬНОЕ РЕШЕНИЕ: Используем события activated/deactivated (Bot API 8.0+)
      // Проверяем версию перед использованием новых событий
      if (tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
        // Событие activated - когда Mini App становится активной (открыта из свернутого состояния)
        tg.onEvent('activated', () => {
          console.log('Mini App активирована - восстанавливаем соединение');
          try {
            tg.expand();
            tg.ready(); // Переподключаемся к Telegram WebApp
            // Обновляем цвета при возврате
            tg.setHeaderColor('#2196F3');
            tg.setBackgroundColor('#E8F4F8');
          } catch (error) {
            console.error('Ошибка при активации Mini App:', error);
          }
        });
        
        // Событие deactivated - когда Mini App становится неактивной (свернута)
        tg.onEvent('deactivated', () => {
          console.log('Mini App деактивирована - приостанавливаем операции');
          // Можно приостановить тяжелые операции или обновления
        });
      } else {
        // Fallback для старых версий: используем браузерное событие visibilitychange
        handleVisibilityChange = () => {
          if (document.visibilityState === 'visible' && tg) {
            console.log('App became visible (visibilitychange fallback), expanding and reconnecting...');
            try {
              tg.expand();
              tg.ready();
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
            console.log('App became hidden (visibilitychange fallback)');
          }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
      }
      
      // ✅ ОФИЦИАЛЬНОЕ РЕШЕНИЕ: Используем событие viewportChanged для отслеживания изменений
      tg.onEvent('viewportChanged', (event) => {
        console.log('Viewport changed:', event);
        // Когда viewport стабилизировался и приложение видимо
        if (event.isStateStable) {
          console.log('Viewport стабилизировался');
          // Проверяем, активна ли Mini App (если доступно)
          if (tg.isActive !== undefined && tg.isActive) {
            // Можно обновить UI при необходимости
          }
        }
        // Также обрабатываем случай, когда viewport становится видимым (для совместимости)
        if (event.isStateVisible) {
          console.log('Viewport стал видимым, разворачиваем приложение...');
          tg.expand();
          tg.ready();
        }
      });
      
      // Обработчик изменения видимости (для мобильных устройств) - дополнительная поддержка
      if (tg.onEvent) {
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
    }
    
    // Обработчик события visibilitychange для браузера (fallback)
    // Используется только если не был установлен выше (для старых версий API)
    if (!handleVisibilityChange) {
      handleVisibilityChange = () => {
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
    }
    
    initializeCache();  
      
    const telegramUser = tg?.initDataUnsafe?.user;
    
    // Если не в Telegram WebApp, показываем страницу входа/регистрации
    if (!isTelegramWebApp || !telegramUser) {
      setLoading(false);
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
    
    // Очистка обработчиков при размонтировании
    return () => {
      // Очистка браузерного события visibilitychange (если было добавлено)
      if (handleVisibilityChange) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
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
  
  const renderPage = () => {
    if (loading) {
      return <LoadingScreen />;
    }
  
    // Если не в Telegram WebApp, показываем страницу входа
    if (!isTelegramWebApp) {
      return <RegistrationPage telegramUser={null} onRegistrationSuccess={handleRegistrationSuccess} isWebBrowser={true} />;
    }
  
    if (!user) {
      const telegramUser = tg?.initDataUnsafe?.user;
      if (!telegramUser) {
        return <RegistrationPage telegramUser={null} onRegistrationSuccess={handleRegistrationSuccess} isWebBrowser={true} />;
      }
      return <RegistrationPage telegramUser={telegramUser} onRegistrationSuccess={handleRegistrationSuccess} />;
    }

    // 4. ГЛАВНАЯ ЛОГИКА: Показываем обучение, если нужно
    // Условие: (флаг в базе false ИЛИ мы включили принудительный показ)
    if (user.status === 'pending') {
      return <PendingPage />;
    }
    if (user.status === 'blocked') {
      return <BlockedPage />;
    }
    if (user.status === 'rejected') {
      return <RejectedPage />;
    }

    // 2. Только если пользователь одобрен, проверяем, видел ли он обучение.
    if (user.status === 'approved' && (!user.has_seen_onboarding || showOnboarding)) {
        return <OnboardingStories onComplete={handleOnboardingComplete} />;
    }
    
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

  // 1. Создаем четкие флаги для отображения навигации
  const isUserApproved = user && user.status === 'approved';
  const showSideNav = isDesktop && isUserApproved && !isOnboardingVisible;
  const showBottomNav = !isDesktop && isUserApproved && !isOnboardingVisible;
  
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

<<<<<<< HEAD
    // ✅ ОФИЦИАЛЬНОЕ РЕШЕНИЕ: Используем события activated/deactivated из Telegram WebApp API
    let sessionVisibilityHandler = null;
    
    if (tg && tg.onEvent && tg.isVersionAtLeast && tg.isVersionAtLeast('8.0')) {
      // Событие activated - когда Mini App становится активной
      tg.onEvent('activated', () => {
        console.log('Mini App активирована - возобновляем сессию');
        isActive = true;
        // Перезапускаем пинг, если он был остановлен
        if (!intervalId && sessionId) {
          startPinging();
        }
      });
      
      // Событие deactivated - когда Mini App становится неактивной
      tg.onEvent('deactivated', () => {
        console.log('Mini App деактивирована - приостанавливаем сессию');
        isActive = false;
        // Не останавливаем пинг полностью, но не будем пинговать пока неактивна
      });
    } else {
      // Fallback для старых версий: используем браузерное событие visibilitychange
      sessionVisibilityHandler = () => {
        if (document.visibilityState === 'visible') {
          console.log('Приложение вернулось в активное состояние (fallback)');
          isActive = true;
          if (tg) {
            tg.expand();
            tg.ready();
          }
          if (!intervalId && sessionId) {
            startPinging();
          }
        } else {
          console.log('Приложение перешло в фоновый режим (fallback)');
          isActive = false;
        }
      };
      
      document.addEventListener('visibilitychange', sessionVisibilityHandler);
    }

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
      // Очищаем только те обработчики, которые были добавлены
      if (sessionVisibilityHandler) {
        document.removeEventListener('visibilitychange', sessionVisibilityHandler);
      }
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
