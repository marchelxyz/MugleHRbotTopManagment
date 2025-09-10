// frontend/src/components/BottomNav.jsx
import React from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';

// 1. Импортируем наши стили
import styles from './BottomNav.module.css';

function BottomNav({ user, activePage, onNavigate }) { 
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
    <div className={styles.nav}>
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
