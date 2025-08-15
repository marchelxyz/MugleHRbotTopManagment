// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect } from 'react';
import { getFeed } from '../api';
import styles from './HomePage.module.css';

function HomePage({ user, onNavigate, telegramPhotoUrl }) {
  const [feed, setFeed] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const feedResponse = await getFeed();
        setFeed(feedResponse.data);
      } catch (error) {
        console.error("Failed to fetch data for home page", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Заглушка для ленты фото
  const photoPlaceholders = [1, 2, 3];

  return (
    <div className={styles.page}>
      {/* --- ШАПКА --- */}
      <div className={styles.header}>
        {/* Содержимое шапки, если нужно */}
      </div>

      {/* --- БЛОК ПОЛЬЗОВАТЕЛЯ --- */}
      <div className={styles.userBlock}>
        {telegramPhotoUrl && <img src={telegramPhotoUrl} alt="User" className={styles.userPhoto} />}
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.last_name}</span>
        </div>
        <button onClick={() => onNavigate('transfer')} className={styles.thankYouButton}>
          <img src="https://postimg.cc/mhC3kSLP" alt="logo" className={styles.thankYouLogo} />
          Отправить спасибки
        </button>
      </div>

      {/* --- БАННЕР --- */}
      <div className={styles.banner}>
        <img src="https://postimg.cc/Cn7s1FGF" alt="New Year Banner" className={styles.bannerImage} />
      </div>

      {/* --- ЛЕНТА С ФОТО (ЗАГЛУШКИ) --- */}
      <div className={styles.photoFeed}>
        {photoPlaceholders.map(p => <div key={p} className={styles.photoPlaceholder}></div>)}
      </div>

      {/* --- ПОСЛЕДНЯЯ АКТИВНОСТЬ --- */}
      <div className={styles.feedContainer}>
        <h3 className={styles.feedTitle}>Последняя активность</h3>
        {isLoading ? <p>Загрузка ленты...</p> : (
          feed.length > 0 ? (
            feed.map((item) => (
              <div key={item.id} className={styles.feedItem}>
                <img src="https://postimg.cc/dk1yB8rK" alt="feed item logo" className={styles.feedItemLogo} />
                <div className={styles.feedContent}>
                  <p className={styles.feedTransaction}>
                    <strong>@{item.sender.username || item.sender.last_name}</strong> &rarr; <strong>@{item.receiver.username || item.receiver.last_name}</strong>
                  </p>
                  <p className={styles.feedMessage}>{item.amount} спасибо - {item.message}</p>
                </div>
              </div>
            ))
          ) : <p>Пока не было переводов.</p>
        )}
      </div>
    </div>
  );
}

export default HomePage;
