// frontend/src/components/UserAvatar.jsx

import React from 'react';
import styles from './UserAvatar.module.css';

// Функция для генерации цвета на основе имени
const FNV1a = (str) => {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return hash >>> 0;
};

const COLORS = ['#e57373', '#81c784', '#64b5f6', '#ffb74d', '#9575cd', '#4db6ac', '#f06292'];

function UserAvatar({ user }) {
  if (!user) return <div className={`${styles.avatar} ${styles.placeholder}`} />;

  // --- НАЧАЛО ИЗМЕНЕНИЙ ---
  // Если есть URL фото, показываем его
  if (user.telegram_photo_url) {
    return <img src={user.telegram_photo_url} alt={`${user.first_name}`} className={styles.avatarImage} />;
  }
  // --- КОНЕЦ ИЗМЕНЕНИЙ ---

  const getInitials = (firstName, lastName) => {
    const first = firstName ? firstName[0] : '';
    const last = lastName ? lastName[0] : '';
    return `${first}${last}`.toUpperCase();
  };

  const initials = getInitials(user.first_name, user.last_name);
  const colorIndex = FNV1a(user.id.toString()) % COLORS.length;
  const backgroundColor = COLORS[colorIndex];

  // Если фото нет, показываем инициалы
  return (
    <div className={styles.avatarText} style={{ backgroundColor }}>
      {initials}
    </div>
  );
}

export default UserAvatar;
