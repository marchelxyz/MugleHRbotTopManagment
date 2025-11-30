// frontend/src/components/BottomNav.jsx
import React, { useState, useEffect } from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';

// 1. Импортируем наши стили
import styles from './BottomNav.module.css';

function BottomNav({ user, activePage, onNavigate }) { 
  const [hasNavigationBar, setHasNavigationBar] = useState(false);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Отслеживаем открытие/закрытие клавиатуры
  useEffect(() => {
    if (!window.visualViewport) return;

    const handleViewportChange = () => {
      const viewportHeight = window.visualViewport.height;
      const windowHeight = window.innerHeight;
      // Если viewport значительно меньше окна, значит клавиатура открыта
      const keyboardThreshold = 150; // Порог для определения открытия клавиатуры
      const keyboardIsOpen = (windowHeight - viewportHeight) > keyboardThreshold;
      setIsKeyboardOpen(keyboardIsOpen);
    };

    window.visualViewport.addEventListener('resize', handleViewportChange);
    window.visualViewport.addEventListener('scroll', handleViewportChange);

    return () => {
      window.visualViewport.removeEventListener('resize', handleViewportChange);
      window.visualViewport.removeEventListener('scroll', handleViewportChange);
    };
  }, []);

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
  
 // Скрываем меню, когда открыта клавиатура
  if (isKeyboardOpen) {
    return null;
  }

 return (
    <div 
      className={styles.nav}
      style={{
        paddingBottom: hasNavigationBar ? 'calc(15px + env(safe-area-inset-bottom))' : '15px'
      }}
    >
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
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
