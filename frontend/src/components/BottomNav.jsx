// frontend/src/components/BottomNav.jsx
import React, { useState, useEffect } from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';

// 1. Импортируем наши стили
import styles from './BottomNav.module.css';

function BottomNav({ user, activePage, onNavigate }) { 
  const [hasNavigationBar, setHasNavigationBar] = useState(false);

  // Отслеживаем видимость системных кнопок навигации
  useEffect(() => {
    // Функция для проверки видимости навигационных кнопок
    const checkNavigationBar = () => {
      let navigationBarVisible = false;
      const screenHeight = window.screen.height;
      const windowHeight = window.innerHeight;
      const screenDiff = screenHeight - windowHeight;

      // Метод 1: Используем visualViewport API (наиболее надежный)
      if (window.visualViewport) {
        const viewportHeight = window.visualViewport.height;
        
        // Когда системные кнопки видны, visualViewport.height меньше window.innerHeight
        // Порог 15px учитывает возможные погрешности измерений
        const threshold = 15;
        const viewportDiff = windowHeight - viewportHeight;
        
        // Системные кнопки есть, если:
        // 1. Разница между window.innerHeight и visualViewport.height значительна
        // 2. ИЛИ разница между screen.height и window.innerHeight указывает на системные элементы
        navigationBarVisible = viewportDiff > threshold || (screenDiff > 40 && viewportDiff > 5);
        
        // Отладочное логирование (можно убрать в продакшене)
        if (process.env.NODE_ENV === 'development') {
          console.log('[BottomNav] VisualViewport check:', {
            viewportHeight,
            windowHeight,
            screenHeight,
            viewportDiff,
            screenDiff,
            navigationBarVisible
          });
        }
      } else {
        // Метод 2: Fallback - проверяем значение env(safe-area-inset-bottom)
        // Создаем временный элемент для проверки значения safe-area-inset-bottom
        const testEl = document.createElement('div');
        testEl.style.position = 'fixed';
        testEl.style.bottom = '0';
        testEl.style.left = '-9999px';
        testEl.style.paddingBottom = 'env(safe-area-inset-bottom)';
        testEl.style.visibility = 'hidden';
        document.body.appendChild(testEl);
        const computedStyle = window.getComputedStyle(testEl);
        const paddingBottom = parseFloat(computedStyle.paddingBottom) || 0;
        document.body.removeChild(testEl);
        
        navigationBarVisible = paddingBottom > 5 || screenDiff > 40;
        
        // Отладочное логирование
        if (process.env.NODE_ENV === 'development') {
          console.log('[BottomNav] Fallback check:', {
            paddingBottom,
            screenDiff,
            navigationBarVisible
          });
        }
      }

      // Дополнительная проверка: если разница между screen.height и window.innerHeight
      // больше 80px, скорее всего есть системные элементы (уменьшил порог для более агрессивного определения)
      if (screenDiff > 80) {
        navigationBarVisible = true;
      }

      // Еще одна проверка: на Android устройствах часто есть системные кнопки
      // Проверяем user agent
      const isAndroid = /Android/i.test(navigator.userAgent);
      if (isAndroid && screenDiff > 30) {
        navigationBarVisible = true;
      }

      setHasNavigationBar(navigationBarVisible);
      
      // Финальное логирование
      if (process.env.NODE_ENV === 'development') {
        console.log('[BottomNav] Final result:', {
          hasNavigationBar: navigationBarVisible,
          screenHeight,
          windowHeight,
          screenDiff
        });
      }
    };

    // Проверяем сразу при монтировании с задержками для корректной инициализации
    // Разные задержки помогают уловить изменения после загрузки страницы
    const initialCheck1 = setTimeout(checkNavigationBar, 50);
    const initialCheck2 = setTimeout(checkNavigationBar, 200);
    const initialCheck3 = setTimeout(checkNavigationBar, 500);

    // Отслеживаем изменения через visualViewport (наиболее точный способ)
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', checkNavigationBar);
      window.visualViewport.addEventListener('scroll', checkNavigationBar);
    }

    // Также отслеживаем изменения размера окна (fallback для старых браузеров)
    window.addEventListener('resize', checkNavigationBar);
    window.addEventListener('orientationchange', checkNavigationBar);

    // Проверяем периодически (на случай, если события не срабатывают надежно)
    // Интервал 500ms обеспечивает плавную реакцию на изменения
    const intervalId = setInterval(checkNavigationBar, 500);

    return () => {
      clearTimeout(initialCheck1);
      clearTimeout(initialCheck2);
      clearTimeout(initialCheck3);
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', checkNavigationBar);
        window.visualViewport.removeEventListener('scroll', checkNavigationBar);
      }
      window.removeEventListener('resize', checkNavigationBar);
      window.removeEventListener('orientationchange', checkNavigationBar);
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
  
 return (
    <div 
      className={styles.nav}
      style={{
        // Всегда учитываем safe-area-inset-bottom, добавляем дополнительный отступ если системные кнопки обнаружены
        paddingBottom: hasNavigationBar 
          ? `calc(5px + max(env(safe-area-inset-bottom, 0px), 20px))` 
          : 'calc(5px + env(safe-area-inset-bottom, 0px))'
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
