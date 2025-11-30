// frontend/src/components/SideNav.jsx (НОВЫЙ ФАЙЛ)

import React, { useState, useEffect } from 'react';
import { FaHome, FaTrophy, FaStore, FaUser, FaCog, FaDice } from 'react-icons/fa';
import styles from './SideNav.module.css';

function SideNav({ user, activePage, onNavigate }) {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // Отслеживаем открытие/закрытие клавиатуры (для мобильных устройств)
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
  
  // Скрываем меню, когда открыта клавиатура (на мобильных устройствах)
  if (isKeyboardOpen && window.innerWidth <= 1024) {
    return null;
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
