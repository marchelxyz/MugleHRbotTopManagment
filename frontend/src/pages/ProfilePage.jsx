// frontend/src/pages/ProfilePage.jsx

import React from 'react';
import styles from './ProfilePage.module.css';

// 1. Принимаем telegramPhotoUrl в пропсах
function ProfilePage({ user, telegramPhotoUrl, onNavigate }) {
  return (
    <div className={styles.page}>
      <h1>👤 Профиль</h1>

      {/* --- НОВЫЙ БЛОК С ФОТО И ИМЕНЕМ --- */}
      <div className={styles.profileHeader}>
        {telegramPhotoUrl && <img src={telegramPhotoUrl} alt="User" className={styles.profilePhoto} />}
        <div className={styles.profileName}>{user.last_name}</div>
        <div className={styles.profilePosition}>{user.position}</div>
      </div>
      {/* --- КОНЕЦ БЛОКА --- */}

      <div className={styles.card}>
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
