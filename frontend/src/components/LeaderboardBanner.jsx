import React, { useMemo, useCallback } from 'react';
import { FaCrown } from 'react-icons/fa';
import styles from './LeaderboardBanner.module.css';

// Цвета для корон
const crownColors = {
  1: '#FFD700', // Золото
  2: '#C0C0C0', // Серебро
  3: '#CD7F32', // Бронза
};

function LeaderboardBanner({ banner, onNavigate }) {
  const { banner_type, data, link_url } = banner;
  
  // Мемоизируем users для предотвращения лишних ререндеров
  const users = useMemo(() => data?.users || [], [data?.users]);
  
  // Мемоизируем title
  const title = useMemo(() => {
    return banner_type === 'leaderboard_receivers'
      ? 'Лидеры прошлого месяца'
      : 'Самые щедрые (прошлый месяц)';
  }, [banner_type]);

  // Мемоизируем обработчик навигации
  const handleNavigate = useCallback(() => {
    // Используем onNavigate для "внутренних" ссылок
    if (link_url && link_url.startsWith('/')) {
      onNavigate(link_url.replace('/', '')); // '/leaderboard' -> 'leaderboard'
    }
  }, [link_url, onNavigate]);

  return (
    // Вот та самая "коробка" с фоном (градиент, как ты просил)
    <div className={styles.bannerBox}>
      <h4 className={styles.title}>{title}</h4>
      <div className={styles.podium}>
        {users.map(user => (
          <div key={user.rank} className={`${styles.podiumItem} ${styles[`place${user.rank}`]}`}>
            <FaCrown 
              className={styles.podiumIcon} 
              color={crownColors[user.rank]} 
            />
            <img 
              src={user.telegram_photo_url || 'placeholder.png'} 
              alt={user.first_name} 
              className={styles.podiumAvatar}
              loading="lazy"
              decoding="async"
              width="60"
              height="60"
            />
            <div className={styles.podiumName}>{user.first_name}</div>
            <div className={styles.podiumPoints}>{user.total_received}</div>
          </div>
        ))}
      </div>
      <button className={styles.navButton} onClick={handleNavigate}>
        Посмотреть весь рейтинг
      </button>
    </div>
  );
}

// Мемоизируем компонент для предотвращения лишних ререндеров
export default React.memo(LeaderboardBanner);
