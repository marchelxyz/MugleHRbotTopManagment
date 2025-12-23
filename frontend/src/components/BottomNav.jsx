// frontend/src/components/BottomNav.jsx
import React, { useState, useEffect } from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';
import { getMarketItems, getLeaderboard, getFeed } from '../api';
import { setCachedData, getCachedData } from '../storage';

// 1. Импортируем наши стили
import styles from './BottomNav.module.css';

function BottomNav({ user, activePage, onNavigate }) { 
  const [hasNavigationBar, setHasNavigationBar] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Отслеживаем видимость системных кнопок навигации
  useEffect(() => {
    // Функция для проверки видимости навигационных кнопок
    const checkNavigationBar = () => {
      let navigationBarVisible = false;

      // Метод 1: Используем visualViewport API (наиболее надежный)
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        // Когда системные кнопки видны, visualViewport.height меньше window.innerHeight
        // Порог 30px учитывает возможные погрешности измерений
        const threshold = 30;
        navigationBarVisible = (windowHeight - viewportHeight) > threshold;
      } else {
        // Метод 2: Fallback - проверяем значение env(safe-area-inset-bottom)
        // Создаем временный элемент для проверки значения safe-area-inset-bottom
        const testEl = document.createElement('div');
        testEl.style.position = 'fixed';
        testEl.style.bottom = '0';
        testEl.style.left = '-9999px'; // Скрываем элемент
        testEl.style.paddingBottom = 'env(safe-area-inset-bottom)';
        document.body.appendChild(testEl);
        const computedStyle = window.getComputedStyle(testEl);
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        document.body.removeChild(testEl);
        navigationBarVisible = paddingBottom > 5; // Порог 5px для учета погрешностей
      }

      setHasNavigationBar(navigationBarVisible);
    };

    // Проверяем сразу при монтировании с небольшой задержкой для корректной инициализации
    const initialCheck = setTimeout(checkNavigationBar, 100);

    // Отслеживаем изменения через visualViewport (наиболее точный способ)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkNavigationBar);
      window.visualViewport.addEventListener('scroll', checkNavigationBar);
    }

    // Также отслеживаем изменения размера окна (fallback для старых браузеров)
    window.addEventListener('resize', checkNavigationBar);

    // Проверяем периодически (на случай, если события не срабатывают надежно)
    // Интервал 300ms обеспечивает плавную реакцию на изменения
    const intervalId = setInterval(checkNavigationBar, 300);

    return () => {
      clearTimeout(initialCheck);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkNavigationBar);
        window.visualViewport.removeEventListener('scroll', checkNavigationBar);
      }
      window.removeEventListener('resize', checkNavigationBar);
      clearInterval(intervalId);
    };
  }, []);

  // Отслеживаем появление экранной клавиатуры
  useEffect(() => {
    const handleViewportChange = () => {
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        const windowHeight = window.innerHeight;
        // Если высота viewport значительно меньше высоты окна, значит появилась клавиатура
        // Порог 150px учитывает различные размеры клавиатур
        const keyboardThreshold = 150;
        const keyboardVisible = (windowHeight - viewportHeight) > keyboardThreshold;
        setIsKeyboardVisible(keyboardVisible);
      }
    };

    // Отслеживаем изменения visualViewport
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    // Также отслеживаем изменения размера окна
    window.addEventListener('resize', handleViewportChange);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('resize', handleViewportChange);
    };
  }, []);

  // Отслеживаем фокус на полях ввода для дополнительной надежности
  useEffect(() => {
    const handleFocusIn = (e) => {
      const target = e.target;
      // Проверяем, является ли элемент полем ввода
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'
      ) {
        setIsKeyboardVisible(true);
      }
    };

    const handleFocusOut = (e) => {
      // Не скрываем сразу при потере фокуса, так как клавиатура может закрываться с задержкой
      // visualViewport API обработает это более точно
      setTimeout(() => {
        if (window.visualViewport) {
          const viewportHeight = window.visualViewport.height;
          const windowHeight = window.innerHeight;
          const keyboardThreshold = 150;
          const keyboardVisible = (windowHeight - viewportHeight) > keyboardThreshold;
          setIsKeyboardVisible(keyboardVisible);
        }
      }, 100);
    };

    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);

    return () => {
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  // Предзагрузка данных для страницы при наведении/касании
  const prefetchPageData = (pageId) => {
    // Предзагружаем только если данных нет в кеше
    switch(pageId) {
      case 'marketplace':
        if (!getCachedData('market')) {
          getMarketItems()
            .then(res => setCachedData('market', res.data))
            .catch(err => console.warn('Prefetch market failed:', err));
        }
        break;
      case 'leaderboard':
        if (!getCachedData('leaderboard')) {
          getLeaderboard({ period: 'current_month', type: 'received' })
            .then(res => setCachedData('leaderboard', res.data))
            .catch(err => console.warn('Prefetch leaderboard failed:', err));
        }
        break;
      case 'home':
        if (!getCachedData('feed')) {
          getFeed()
            .then(res => setCachedData('feed', res.data))
            .catch(err => console.warn('Prefetch feed failed:', err));
        }
        break;
      default:
        // Для других страниц предзагрузка не требуется
        break;
    }
  };

  const handleNavInteraction = (pageId) => {
    // Предзагружаем данные при взаимодействии с навигацией
    prefetchPageData(pageId);
  };

  const navItems = [
    { id: 'home', label: 'Лента', icon: <FaHome size={22} /> },
    { id: 'leaderboard', label: 'Рейтинг', icon: <FaTrophy size={22} /> },
    { id: 'roulette', label: 'Рулетка', icon: <FaDice size={22} /> },
    { id: 'marketplace', label: 'Магазин', icon: <FaStore size={22} /> },
    { id: 'profile', label: 'Профиль', icon: <FaUser size={22} /> },
  ];

    if (user && user.is_admin) {
    navItems.push({ id: 'admin', label: 'Админ', icon: <FaCog size={22} /> });
  }
  
 return (
    <div 
      className={`${styles.nav} ${isKeyboardVisible ? styles.hidden : ''}`}
      style={{
        paddingBottom: hasNavigationBar ? 'calc(15px + env(safe-area-inset-bottom))' : '15px'
      }}
    >
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          onMouseEnter={() => handleNavInteraction(item.id)}
          onTouchStart={() => handleNavInteraction(item.id)}
          className={`${styles.navButton} ${activePage === item.id ? styles.active : ''}`}
        >
          {item.icon}
          <span className={styles.navLabel}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export default BottomNav;
