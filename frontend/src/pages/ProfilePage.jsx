// frontend/src/pages/ProfilePage.jsx

import React from 'react';
import styles from './ProfilePage.module.css';
import { FaCog } from 'react-icons/fa';

function ProfilePage({ user, telegramPhotoUrl, onNavigate }) {
  return (
    <div className={styles.page}>
      <div className={styles.settingsIconContainer}>
        {/* Эта кнопка вызывает переход на страницу 'settings' */}
        <button onClick={() => onNavigate('settings')} className={styles.settingsButton}>
          <FaCog size={22} />
        </button>
      </div>

      <h1>👤 Профиль</h1>

      <div className={styles.profileHeader}>
        {telegramPhotoUrl && <img src={telegramPhotoUrl} alt="User" className={styles.profilePhoto} />}
        <div className={styles.profileName}>{user.last_name}</div>
        <div className={styles.profilePosition}>{user.position}</div>
      </div>

      <div className={styles.card}>
        {/* ... остальная информация профиля без изменений ... */}
        <p className={styles.infoItem}>
          <span className={styles.label}>Подразделение:</span>
          {user.department}
        </p>
        <p className={styles.infoItem}>
          <span className={styles.label}>Телефон:</span>
          {user.phone_number || 'Не указан'}
        </p>
        <p className={styles.infoItem}>
          <span className={styles.label}>Дата рождения:</span>
          {user.date_of_birth || 'Не указана'}
        </p>
        <p className={styles.infoItem}>
          <span className={styles.label}>Баланс:</span>
          {user.balance} баллов
        </p>
      </div>

      <button
        onClick={() => onNavigate('history')}
        className={styles.historyButton}
      >
        История транзакций
      </button>
    </div>
  );
}

export default ProfilePage;
