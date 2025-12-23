// frontend/src/components/SideNav.jsx (НОВЫЙ ФАЙЛ)

import React, { useMemo, useCallback } from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';
import styles from './SideNav.module.css';

// Маппинг страниц для prefetch
const pagePrefetchMap = {
  'home': () => import('../pages/HomePage'),
  'leaderboard': () => import('../pages/LeaderboardPage'),
  'roulette': () => import('../pages/RoulettePage'),
  'marketplace': () => import('../pages/MarketplacePage'),
  'profile': () => import('../pages/ProfilePage'),
  'admin': () => import('../pages/AdminPage'),
};

function SideNav({ user, activePage, onNavigate }) { 
  // Мемоизируем navItems для предотвращения лишних ререндеров
  const navItems = useMemo(() => {
    const items = [
      { id: 'home', label: 'Лента', icon: <FaHome size={20} /> },
      { id: 'leaderboard', label: 'Рейтинг', icon: <FaTrophy size={20} /> },
      { id: 'roulette', label: 'Рулетка', icon: <FaDice size={20} /> },
      { id: 'marketplace', label: 'Магазин', icon: <FaStore size={20} /> },
      { id: 'profile', label: 'Профиль', icon: <FaUser size={20} /> },
    ];

    if (user && user.is_admin) {
      items.push({ id: 'admin', label: 'Админ', icon: <FaCog size={20} /> });
    }
    
    return items;
  }, [user]);

  // Prefetch страницы при наведении для мгновенной загрузки
  const handleMouseEnter = useCallback((pageId) => {
    if (pagePrefetchMap[pageId] && activePage !== pageId) {
      pagePrefetchMap[pageId]().catch(() => {
        // Игнорируем ошибки prefetch
      });
    }
  }, [activePage]);

  // Мемоизируем обработчик клика
  const handleClick = useCallback((pageId) => {
    onNavigate(pageId);
  }, [onNavigate]);
  
  return (
    <div className={styles.nav}>
      <div className={styles.header}>
        <img 
            src="https://i.postimg.cc/RVsHnPHk/LOGO-SP-SIN.webp" 
            alt="Лого" 
            loading="eager"
            decoding="async"
            width="40"
            height="40"
        />
        <span>Спасибо</span>
      </div>
      <div className={styles.menu}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => handleClick(item.id)}
            onMouseEnter={() => handleMouseEnter(item.id)}
            className={`${styles.navButton} ${activePage === item.id ? styles.active : ''}`}
          >
            {item.icon}
            <span className={styles.navLabel}>{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Мемоизируем компонент для предотвращения лишних ререндеров
export default React.memo(SideNav);
