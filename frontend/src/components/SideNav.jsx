// frontend/src/components/SideNav.jsx (НОВЫЙ ФАЙЛ)

import React from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';
import styles from './SideNav.module.css';

function SideNav({ user, activePage, onNavigate }) { 
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
