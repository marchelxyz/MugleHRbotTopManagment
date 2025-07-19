// frontend/src/pages/ProfilePage.jsx

import React from 'react';
import styles from './ProfilePage.module.css';

// Принимаем onNavigate в пропсах
function ProfilePage({ user, onNavigate }) {
  return (
    <div className={styles.page}>
      <h1>👤 Профиль</h1>
      <div className={styles.card}>
        <p className={styles.infoItem}>
          <span className={styles.label}>Имя:</span>
          {user.last_name}
        </p>
        <p className={styles.infoItem}>
          <span className={styles.label}>Должность:</span>
          {user.position}
        </p>
        <p className={styles.infoItem}>
          <span className={styles.label}>Баланс:</span>
          {user.balance} баллов
        </p>
      </div>

      {/* Кнопка для перехода к истории */}
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
