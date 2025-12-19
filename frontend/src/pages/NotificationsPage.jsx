// frontend/src/pages/NotificationsPage.jsx

import React, { useState, useEffect } from 'react';
import styles from './NotificationsPage.module.css';
import PageLayout from '../components/PageLayout';
import { FaBell, FaCheckCircle, FaTimesCircle, FaGift, FaUserEdit, FaInfoCircle } from 'react-icons/fa';

function NotificationsPage({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // 'all', 'purchases', 'profile', 'system'

  // Заглушка для уведомлений - в реальности нужно будет получать их с сервера
  useEffect(() => {
    // Здесь будет запрос к API для получения уведомлений
    // Пока используем заглушку
    const mockNotifications = [
      {
        id: 1,
        type: 'purchase',
        title: 'Покупка одобрена',
        message: 'Ваш локальный подарок "Подарочная карта" был одобрен администратором',
        timestamp: new Date(Date.now() - 3600000),
        read: false
      },
      {
        id: 2,
        type: 'profile',
        title: 'Изменения профиля одобрены',
        message: 'Ваши изменения в профиле были одобрены администратором',
        timestamp: new Date(Date.now() - 7200000),
        read: false
      },
      {
        id: 3,
        type: 'system',
        title: 'Добро пожаловать!',
        message: 'Спасибо за регистрацию в системе "Спасибо"',
        timestamp: new Date(Date.now() - 86400000),
        read: true
      }
    ];
    setNotifications(mockNotifications);
  }, []);

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'purchase':
        return <FaGift className={styles.notificationIcon} />;
      case 'profile':
        return <FaUserEdit className={styles.notificationIcon} />;
      case 'system':
        return <FaInfoCircle className={styles.notificationIcon} />;
      default:
        return <FaBell className={styles.notificationIcon} />;
    }
  };

  const formatTimestamp = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'только что';
    if (minutes < 60) return `${minutes} мин. назад`;
    if (hours < 24) return `${hours} ч. назад`;
    if (days < 7) return `${days} дн. назад`;
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : notifications.filter(n => n.type === filter);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <PageLayout title="Уведомления">
      <button onClick={onBack} className={styles.backButton}>
        &larr; Назад в профиль
      </button>

      {unreadCount > 0 && (
        <div className={styles.unreadBadge}>
          {unreadCount} непрочитанных
        </div>
      )}

      <div className={styles.filterButtons}>
        <button
          onClick={() => setFilter('all')}
          className={`${styles.filterButton} ${filter === 'all' ? styles.active : ''}`}
        >
          Все
        </button>
        <button
          onClick={() => setFilter('purchases')}
          className={`${styles.filterButton} ${filter === 'purchases' ? styles.active : ''}`}
        >
          Покупки
        </button>
        <button
          onClick={() => setFilter('profile')}
          className={`${styles.filterButton} ${filter === 'profile' ? styles.active : ''}`}
        >
          Профиль
        </button>
        <button
          onClick={() => setFilter('system')}
          className={`${styles.filterButton} ${filter === 'system' ? styles.active : ''}`}
        >
          Система
        </button>
      </div>

      <div className={styles.notificationsList}>
        {filteredNotifications.length === 0 ? (
          <div className={styles.emptyState}>
            <FaBell className={styles.emptyIcon} />
            <p>Нет уведомлений</p>
          </div>
        ) : (
          filteredNotifications.map(notification => (
            <div
              key={notification.id}
              className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''}`}
            >
              <div className={styles.notificationIconContainer}>
                {getNotificationIcon(notification.type)}
              </div>
              <div className={styles.notificationContent}>
                <div className={styles.notificationHeader}>
                  <h3 className={styles.notificationTitle}>{notification.title}</h3>
                  <span className={styles.notificationTime}>
                    {formatTimestamp(notification.timestamp)}
                  </span>
                </div>
                <p className={styles.notificationMessage}>{notification.message}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </PageLayout>
  );
}

export default NotificationsPage;
