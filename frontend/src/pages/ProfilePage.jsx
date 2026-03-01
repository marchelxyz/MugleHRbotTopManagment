// frontend/src/pages/ProfilePage.jsx

import React, { useState, useEffect } from 'react';
import styles from './ProfilePage.module.css';
import { FaCog, FaCreditCard, FaPencilAlt, FaBell } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import { formatDateForDisplay } from '../utils/dateFormatter';
import { getUnreadNotificationCount } from '../api';

function ProfilePage({ user, telegramPhotoUrl, onNavigate }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    getUnreadNotificationCount()
      .then(res => setUnreadCount(res.data.unread_count || 0))
      .catch(() => {});
  }, [user]);

  // --- 1. ГЛАВНОЕ ИСПРАВЛЕНИЕ: Добавляем проверку на наличие user ---
  if (!user) {
    return (
      <PageLayout title="Профиль">
        <div>Загрузка данных пользователя...</div>
      </PageLayout>
    );
  }

  // Теперь, когда мы уверены, что user существует, можно форматировать дату
  const displayDateOfBirth = formatDateForDisplay(user.date_of_birth);
  
  return (
    <PageLayout title="Профиль">
      <div className={styles.settingsIconContainer}>
        <button onClick={() => onNavigate('settings')} className={styles.settingsButton}>
          <FaCog size={22} />
        </button>
      </div>

      <div className={styles.profileHeader}>
        {telegramPhotoUrl && <img src={telegramPhotoUrl} alt="User" className={styles.profilePhoto} />}
        <div className={styles.profileNameContainer}> 
            <div className={styles.profileName}>{user.first_name} {user.last_name}</div>
            <button onClick={() => onNavigate('edit_profile')} className={styles.editButton}>
                <FaPencilAlt size={16} />
            </button>
        </div>
        <div className={styles.profilePosition}>{user.position}</div>
      </div>

      {/* --- 2. ИСПРАВЛЕНИЕ ВЕРСТКИ: Все <p> теперь внутри .card --- */}
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
          {/* Используем новое имя переменной */}
          {displayDateOfBirth || 'Не указана'}
        </p>
        <p className={styles.infoItem}>
          <span className={styles.label}>Накоплено:</span>
          {user.balance} спасибок
        </p>
        <p className={styles.infoItem}><span className={styles.label}>Билеты для рулетки:</span> {user.tickets} шт.</p>
        <p className={styles.infoItem}><span className={styles.label}>Части билетов:</span> {user.ticket_parts} / 4</p>
      </div>

      <div className={styles.actionsGrid}>
        <button onClick={() => onNavigate('history')} className={styles.actionButton}>История транзакций</button>
        <button onClick={() => onNavigate('bonus_card')} className={styles.actionButton}>
          <FaCreditCard style={{ marginRight: '8px' }} />
          Бонусная карта
        </button>
        <button onClick={() => onNavigate('notifications')} className={styles.actionButton} style={{ position: 'relative' }}>
          <FaBell style={{ marginRight: '8px' }} />
          Уведомления
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute', top: '6px', right: '10px',
              background: '#e74c3c', color: '#fff', borderRadius: '50%',
              minWidth: '20px', height: '20px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: 'bold',
            }}>{unreadCount}</span>
          )}
        </button>
      </div>
    </PageLayout>
  );
}

export default ProfilePage;
