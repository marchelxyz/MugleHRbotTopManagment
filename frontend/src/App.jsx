// frontend/src/App.jsx

import React, { useState, useEffect, useRef } from 'react';
import { checkUserStatus, getFeed, getBanners, setGlobalAbortController } from './api';
import { initializeCache, clearCache, setCachedData } from './storage';
import { isTelegramMode, getToken, getUser as getStoredUser, clearAuth } from './utils/auth';
import axios from 'axios';

// Компоненты и страницы
import BottomNav from './components/BottomNav';
import SideNav from './components/SideNav';
import RegistrationPage from './pages/RegistrationPage';
import LoginPage from './pages/LoginPage';
import BrowserRegistrationPage from './pages/BrowserRegistrationPage';
import PasswordResetPage from './pages/PasswordResetPage';
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

const API_BASE_URL = import.meta.env.VITE_API_URL;
const tg = window.Telegram?.WebApp;

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState('home');
  const [telegramPhotoUrl, setTelegramPhotoUrl] = useState(null);
  const [showPendingBanner, setShowPendingBanner] = useState(false);
 // 2. Добавляем новое состояние для принудительного показа обучения
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // AbortController для отмены активных запросов при выходе
  const abortControllerRef = useRef(null);
  
  // Определяем режим работы (Telegram или браузер)
  const telegramMode = isTelegramMode();
  
  // Определяем, является ли устройство десктопом
  // Для планшетов (768px-1024px) будем использовать мобильный интерфейс
  const isDesktop = telegramMode 
    ? ['tdesktop', 'macos', 'web'].includes(tg?.platform) && windowWidth > 1024
    : windowWidth > 1024;
  
  // Отслеживаем изменение размера окна
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Инициализация AbortController при монтировании
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    // Устанавливаем глобальный AbortController для API клиента
    setGlobalAbortController(abortControllerRef.current);
    
    return () => {
      // Отменяем все активные запросы при размонтировании
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
        setGlobalAbortController(new AbortController());
      }
    };
  }, []);

  // Обработчики событий для очистки ресурсов при выходе
  useEffect(() => {
    const cleanup = () => {
      // Отменяем все активные запросы
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      // Очищаем все интервалы
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
      }
    };

    const handleBeforeUnload = () => {
      cleanup();
    };

    const handleVisibilityChange = () => {
      // Если приложение скрыто, отменяем активные запросы
      if (document.hidden) {
        cleanup();
        // Создаем новый контроллер для будущих запросов (если приложение вернется)
        abortControllerRef.current = new AbortController();
        setGlobalAbortController(abortControllerRef.current);
      }
    };

    // Обработчик закрытия через Telegram Web App API
    const handleTelegramClose = () => {
      cleanup();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    // Подписываемся на события Telegram Web App
    if (telegramMode && tg) {
      if (typeof tg.onEvent === 'function') {
        tg.onEvent('viewportChanged', handleTelegramClose);
      }
      if (typeof tg.BackButton?.onClick === 'function') {
        tg.BackButton.onClick(handleTelegramClose);
      }
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Отменяем подписки Telegram Web App
      if (telegramMode && tg) {
        if (typeof tg.offEvent === 'function') {
          tg.offEvent('viewportChanged', handleTelegramClose);
        }
      }
      cleanup();
    };
  }, [telegramMode]);

  useEffect(() => {
    initializeCache();
    
    // Режим Telegram
    if (telegramMode && tg) {
      // Безопасно вызываем методы Telegram Web App
      try {
        if (typeof tg.ready === 'function') {
          tg.ready();
        }
        if (typeof tg.expand === 'function') {
          tg.expand();
        }
        // Проверяем поддержку методов перед вызовом
        if (tg.setBackgroundColor && typeof tg.setBackgroundColor === 'function') {
          try {
            tg.setBackgroundColor('#E8F4F8'); // Зимний фон
          } catch (error) {
            console.warn('setBackgroundColor не поддерживается:', error);
          }
        }
        if (tg.setHeaderColor && typeof tg.setHeaderColor === 'function') {
          try {
            tg.setHeaderColor('#2196F3'); // Зимний голубой
          } catch (error) {
            console.warn('setHeaderColor не поддерживается:', error);
          }
        }
      } catch (error) {
        console.warn('Ошибка при инициализации Telegram Web App:', error);
      }
      
      const telegramUser = tg.initDataUnsafe?.user;
      if (!telegramUser || !telegramUser.id) {
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
              // Игнорируем ошибки отмены запросов
              if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message?.includes('canceled')) {
                return null;
              }
              console.warn('Не удалось предзагрузить feed:', err);
              return null;
            }),
            getBanners().catch(err => {
              // Игнорируем ошибки отмены запросов
              if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message?.includes('canceled')) {
                return null;
              }
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
    }
    // Режим браузера
    else {
      const token = getToken();
      
      // Если нет токена, показываем страницу входа
      if (!token) {
        setLoading(false);
        return;
      }

      // Загружаем пользователя по токену
      const fetchUserFromToken = async () => {
        try {
          const response = await axios.get(`${API_BASE_URL}/auth/me`, {
            headers: {
              Authorization: `Bearer ${token}`
            }
          });
          
          const userData = response.data;
          setUser(userData);
          
          // Предзагружаем данные для главной страницы
          try {
            const [feedResponse, bannersResponse] = await Promise.all([
              getFeed().catch(err => {
                // Игнорируем ошибки отмены запросов
                if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message?.includes('canceled')) {
                  return null;
                }
                console.warn('Не удалось предзагрузить feed:', err);
                return null;
              }),
              getBanners().catch(err => {
                // Игнорируем ошибки отмены запросов
                if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message?.includes('canceled')) {
                  return null;
                }
                console.warn('Не удалось предзагрузить banners:', err);
                return null;
              })
            ]);
            
            if (feedResponse?.data) {
              setCachedData('feed', feedResponse.data);
            }
            if (bannersResponse?.data) {
              setCachedData('banners', bannersResponse.data);
            }
          } catch (err) {
            console.warn('Ошибка при предзагрузке данных:', err);
          }
        } catch (err) {
          console.error('Ошибка при загрузке пользователя:', err);
          // Если токен недействителен, очищаем его
          if (err.response && err.response.status === 401) {
            clearAuth();
          }
        } finally {
          setLoading(false);
        }
      };

      fetchUserFromToken();
    }
  }, [telegramMode]);
  
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
  
    // Проверяем URL для страниц регистрации и восстановления пароля (только в браузерном режиме)
    if (!telegramMode) {
      const path = window.location.pathname;
      if (path === '/register' || path === '/registration') {
        return <BrowserRegistrationPage />;
      }
      if (path === '/reset-password' || path === '/forgot-password') {
        return <PasswordResetPage />;
      }
    }
  
    // Если браузерный режим и нет пользователя - показываем страницу входа
    if (!telegramMode && !user) {
      return <LoginPage />;
    }
  
    // Если Telegram режим и нет пользователя - показываем регистрацию
    if (telegramMode && !user) {
      const telegramUser = tg?.initDataUnsafe?.user;
      // Проверяем, что telegramUser существует и имеет обязательные поля
      if (telegramUser && telegramUser.id) {
        return <RegistrationPage telegramUser={telegramUser} onRegistrationSuccess={handleRegistrationSuccess} />;
      }
      // Если Telegram режим определен, но данные пользователя отсутствуют, показываем ошибку
      return (
        <div style={{ padding: '20px', textAlign: 'center' }}>
          <h2>Ошибка загрузки</h2>
          <p>Данные Telegram не найдены. Пожалуйста, откройте приложение через Telegram.</p>
        </div>
      );
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
    // Отслеживание сессии работает только в Telegram режиме
    if (!telegramMode || !user) {
      return;
    }

    let sessionId = null;

    const sessionManager = async () => {
      try {
        // 1. При запуске приложения создаем новую сессию
        const response = await startSession();
        sessionId = response.data.id;
        console.log('Сессия успешно запущена, ID:', sessionId);

        // 2. Запускаем интервал, который будет "пинговать" сессию
        sessionIntervalRef.current = setInterval(async () => {
          if (sessionId && !abortControllerRef.current?.signal.aborted) {
            try {
              await pingSession(sessionId);
              console.log(`Пинг для сессии ${sessionId} успешен.`);
            } catch (pingError) {
              // Игнорируем ошибки отмены запросов
              if (pingError.name === 'AbortError' || pingError.code === 'ERR_CANCELED' || pingError.message?.includes('canceled')) {
                if (sessionIntervalRef.current) {
                  clearInterval(sessionIntervalRef.current);
                  sessionIntervalRef.current = null;
                }
                return;
              }
              console.error('Ошибка пинга сессии:', pingError);
              // Если сессия не найдена на сервере, прекращаем пинговать
              if (pingError.response && pingError.response.status === 404) {
                if (sessionIntervalRef.current) {
                  clearInterval(sessionIntervalRef.current);
                  sessionIntervalRef.current = null;
                }
              }
            }
          } else {
            // Если запросы отменены, останавливаем интервал
            if (sessionIntervalRef.current) {
              clearInterval(sessionIntervalRef.current);
              sessionIntervalRef.current = null;
            }
          }
        }, PING_INTERVAL);

      } catch (startError) {
        // Ошибки могут возникать, если пользователь не авторизован или метод не поддерживается
        // Логируем только если это не ожидаемая ошибка
        const isExpectedError = 
          startError.message === 'Telegram ID не найден' || 
          startError.response?.status === 422 ||
          startError.response?.status === 404;
        
        if (!isExpectedError) {
          console.error('Не удалось запустить сессию:', startError);
        } else {
          // Тихая обработка ожидаемых ошибок (пользователь не зарегистрирован, сессия уже существует и т.д.)
          console.debug('Сессия не запущена (ожидаемое поведение):', startError.message || `Статус ${startError.response?.status}`);
        }
      }
    };

    sessionManager();

    // 3. Функция очистки: сработает, когда пользователь закроет приложение
    return () => {
      if (sessionIntervalRef.current) {
        clearInterval(sessionIntervalRef.current);
        sessionIntervalRef.current = null;
        console.log('Отслеживание сессии остановлено.');
      }
      // Отменяем активные запросы сессии
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [telegramMode, user]); // Зависимость от telegramMode и user

    // --- АВТОМАТИЧЕСКАЯ ПРОВЕРКА СТАТУСА ДЛЯ ПОЛЬЗОВАТЕЛЕЙ СО СТАТУСОМ PENDING ---
  const statusCheckIntervalRef = useRef(null);
  const sessionIntervalRef = useRef(null);

  useEffect(() => {
    // Проверяем статус только если пользователь существует и его статус 'pending'
    // И только в Telegram режиме
    if (!telegramMode || !user || user.status !== 'pending') {
      // Очищаем интервал, если статус изменился на не-pending
      if (statusCheckIntervalRef.current) {
        clearInterval(statusCheckIntervalRef.current);
        statusCheckIntervalRef.current = null;
      }
      return;
    }

    const telegramUser = tg?.initDataUnsafe?.user;
    if (!telegramUser) {
      return;
    }

    const checkStatus = async () => {
      // Проверяем, не отменены ли запросы
      if (abortControllerRef.current?.signal.aborted) {
        if (statusCheckIntervalRef.current) {
          clearInterval(statusCheckIntervalRef.current);
          statusCheckIntervalRef.current = null;
        }
        return;
      }
      
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
        // Игнорируем ошибки отмены запросов
        if (err.name === 'AbortError' || err.code === 'ERR_CANCELED' || err.message?.includes('canceled')) {
          if (statusCheckIntervalRef.current) {
            clearInterval(statusCheckIntervalRef.current);
            statusCheckIntervalRef.current = null;
          }
          return;
        }
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
  }, [user, telegramMode]); // Зависимость от user и telegramMode

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
