// frontend/src/components/SideNav.jsx (НОВЫЙ ФАЙЛ)

import React from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';
import { getMarketItems, getLeaderboard, getFeed } from '../api';
import { setCachedData, getCachedData } from '../storage';
import styles from './SideNav.module.css';

function SideNav({ user, activePage, onNavigate }) { 
  // Предзагрузка данных для страницы при наведении
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
    { id: 'home', label: 'Лента', icon: <FaHome size={20} /> },
    { id: 'leaderboard', label: 'Рейтинг', icon: <FaTrophy size={20} /> },
    { id: 'roulette', label: 'Рулетка', icon: <FaDice size={20} /> },
    { id: 'marketplace', label: 'Магазин', icon: <FaStore size={20} /> },
    { id: 'profile', label: 'Профиль', icon: <FaUser size={20} /> },
  ];

  if (user && user.is_admin) {
    navItems.push({ id: 'admin', label: 'Админ', icon: <FaCog size={20} /> });
  }
  
  return (
    <div className={styles.nav}>
      <div className={styles.header}>
        <img src="https://i.postimg.cc/RVsHnPHk/LOGO-SP-SIN.webp" alt="Лого" />
        <span>Спасибо</span>
      </div>
      <div className={styles.menu}>
        {navItems.map(item => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            onMouseEnter={() => handleNavInteraction(item.id)}
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

export default SideNav;
