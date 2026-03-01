import React, { useState, useEffect, useCallback } from 'react';
import styles from './NotificationsPage.module.css';
import PageLayout from '../components/PageLayout';
import { FaBell, FaGift, FaUserEdit, FaInfoCircle, FaExchangeAlt, FaUsers, FaCheckDouble, FaSpinner, FaCopy, FaCheck } from 'react-icons/fa';
import { getNotifications, markNotificationRead, markAllNotificationsRead } from '../api';

function NotificationsPage({ user, onBack }) {
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const typeMap = {
    all: null,
    purchase: 'purchase',
    profile: 'profile',
    system: 'system',
    transfer: 'transfer',
    shared_gift: 'shared_gift',
  };

  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const response = await getNotifications(typeMap[filter]);
      const data = response.data;
      setNotifications(data.items || []);
      setUnreadCount(data.unread_count || 0);
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.is_read) {
      try {
        await markNotificationRead(notification.id);
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch (error) {
        console.error('Failed to mark notification as read:', error);
      }
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'purchase':
        return <FaGift className={styles.notificationIcon} />;
      case 'profile':
        return <FaUserEdit className={styles.notificationIcon} />;
      case 'transfer':
        return <FaExchangeAlt className={styles.notificationIcon} />;
      case 'shared_gift':
        return <FaUsers className={styles.notificationIcon} />;
      case 'system':
        return <FaInfoCircle className={styles.notificationIcon} />;
      default:
        return <FaBell className={styles.notificationIcon} />;
    }
  };

  const formatTimestamp = (dateStr) => {
    const date = new Date(dateStr);
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

  const [copiedId, setCopiedId] = useState(null);

  function parseMessageWithCode(message) {
    const match = message.match(/\[code\]([\s\S]*?)\[\/code\]/);
    if (!match) return { text: message, code: null };
    const text = message.replace(/\n?\[code\][\s\S]*?\[\/code\]/, '').trim();
    return { text, code: match[1] };
  }

  function handleCopyCode(e, code, notificationId) {
    e.stopPropagation();
    navigator.clipboard.writeText(code).then(() => {
      setCopiedId(notificationId);
      setTimeout(() => setCopiedId(null), 2000);
    });
  }

  const filters = [
    { key: 'all', label: 'Все' },
    { key: 'purchase', label: 'Покупки' },
    { key: 'profile', label: 'Профиль' },
    { key: 'transfer', label: 'Переводы' },
    { key: 'shared_gift', label: 'Совместные' },
    { key: 'system', label: 'Система' },
  ];

  return (
    <PageLayout title="Уведомления">
      <button onClick={onBack} className={styles.backButton}>
        &larr; Назад в профиль
      </button>

      {unreadCount > 0 && (
        <div className={styles.unreadBadge} onClick={handleMarkAllRead} style={{ cursor: 'pointer' }}>
          <FaCheckDouble style={{ marginRight: '6px' }} />
          {unreadCount} непрочитанных — нажмите, чтобы прочитать все
        </div>
      )}

      <div className={styles.filterButtons}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`${styles.filterButton} ${filter === f.key ? styles.active : ''}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className={styles.notificationsList}>
        {loading ? (
          <div className={styles.emptyState}>
            <FaSpinner className={`${styles.emptyIcon} ${styles.spinning}`} />
            <p>Загрузка...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <FaBell className={styles.emptyIcon} />
            <p>Нет уведомлений</p>
          </div>
        ) : (
          notifications.map(notification => (
            <div
              key={notification.id}
              className={`${styles.notificationItem} ${!notification.is_read ? styles.unread : ''}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className={styles.notificationIconContainer}>
                {getNotificationIcon(notification.type)}
              </div>
              <div className={styles.notificationContent}>
                <div className={styles.notificationHeader}>
                  <h3 className={styles.notificationTitle}>{notification.title}</h3>
                  <span className={styles.notificationTime}>
                    {formatTimestamp(notification.created_at)}
                  </span>
                </div>
                {(() => {
                  const { text, code } = parseMessageWithCode(notification.message);
                  return (
                    <>
                      <p className={styles.notificationMessage}>{text}</p>
                      {code && (
                        <div className={styles.codeBlock}>
                          <span className={styles.codeValue}>{code}</span>
                          <button
                            className={styles.copyButton}
                            onClick={(e) => handleCopyCode(e, code, notification.id)}
                            title="Скопировать"
                          >
                            {copiedId === notification.id
                              ? <><FaCheck /> Скопировано</>
                              : <><FaCopy /> Скопировать</>}
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </div>
          ))
        )}
      </div>
    </PageLayout>
  );
}

export default NotificationsPage;
