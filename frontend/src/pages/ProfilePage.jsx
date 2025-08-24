// frontend/src/pages/ProfilePage.jsx

import React, { useEffect } from 'react'; // --- ИСПРАВЛЕНИЕ: Добавляем импорт useEffect ---
import styles from './ProfilePage.module.css';
import { FaCog } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import { preloadHistoryData } from '../preloader';

function ProfilePage({ user, telegramPhotoUrl, onNavigate }) {

  useEffect(() => {
    if (user) {
      preloadHistoryData(user.id);
    }
  }, [user]);
  
  return (
    <PageLayout title="Профиль">
      <div className={styles.settingsIconContainer}>
        <button onClick={() => onNavigate('settings')} className={styles.settingsButton}>
          <FaCog size={22} />
        </button>
      </div>

      <div className={styles.profileHeader}>
        {telegramPhotoUrl && <img src={telegramPhotoUrl} alt="User" className={styles.profilePhoto} />}
        <div className={styles.profileName}>{user.last_name}</div>
        <div className={styles.profilePosition}>{user.position}</div>
      </div>

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
            <span className={styles.label}>Накоплено (для трат):</span>
            {user.balance} баллов
        </p>
        <p className={styles.infoItem}>
            <span className={styles.label}>Для переводов (в этом месяце):</span>
            {user.transfer_balance} баллов
        </p>
      </div>

      <button
        onClick={() => onNavigate('history')}
        className={styles.historyButton}
      >
        История транзакций
      </button>
    </PageLayout>
  );
}

export default ProfilePage;
