// frontend/src/components/BottomNav.jsx
import React from 'react';
// Импортируем иконки из разных наборов
import { FaHome, FaTrophy, FaStore, FaUser } from 'react-icons/fa';

// Стили для кнопок навигации
const navButtonStyle = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  flexGrow: 1,
  border: 'none',
  background: 'none',
  padding: '5px 0',
  cursor: 'pointer',
  color: '#888', // Цвет неактивной иконки
};

const navLabelStyle = {
  fontSize: '12px',
  marginTop: '4px',
};

function BottomNav({ activePage, onNavigate }) {
  const navItems = [
    { id: 'home', label: 'Лента', icon: <FaHome size={22} /> },
    { id: 'leaderboard', label: 'Рейтинг', icon: <FaTrophy size={22} /> },
    { id: 'marketplace', label: 'Магазин', icon: <FaStore size={22} /> },
    { id: 'profile', label: 'Профиль', icon: <FaUser size={22} /> },
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      display: 'flex',
      justifyContent: 'space-around',
      backgroundColor: '#fff',
      borderTop: '1px solid #eee',
      padding: '5px 0',
    }}>
      {navItems.map(item => (
        <button
          key={item.id}
          onClick={() => onNavigate(item.id)}
          style={{ ...navButtonStyle, color: activePage === item.id ? '#007bff' : '#888' }}
        >
          {item.icon}
          <span style={navLabelStyle}>{item.label}</span>
        </button>
      ))}
    </div>
  );
}

export default BottomNav;
