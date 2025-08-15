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

  const photoPlaceholders = [1, 2, 3];

  return (
    <div className={styles.page}>
      <div className={styles.header}></div>

      <div className={styles.userBlock}>
        {telegramPhotoUrl && <img src={telegramPhotoUrl} alt="User" className={styles.userPhoto} />}
        <div className={styles.userInfo}>
          <span className={styles.userName}>{user.last_name}</span>
        </div>
        {/* --- ИЗМЕНЕНИЕ: Новая ссылка на логотип в кнопке --- */}
        <button onClick={() => onNavigate('transfer')} className={styles.thankYouButton}>
          <img src="https://i.postimg.cc/wxbwWWnQ/image.webp" alt="logo" className={styles.thankYouLogo} />
          Отправить спасибки
        </button>
      </div>

      <div className={styles.banner}>
        {/* --- ИЗМЕНЕНИЕ: Новая ссылка на баннер --- */}
        <img src="https://i.postimg.cc/kD31TGDt/234.webp" alt="Banner" className={styles.bannerImage} />
      </div>

      <div className={styles.photoFeed}>
        {photoPlaceholders.map(p => <div key={p} className={styles.photoPlaceholder}></div>)}
      </div>

      <div className={styles.feedContainer}>
        <h3 className={styles.feedTitle}>Последняя активность</h3>
        {isLoading ? <p>Загрузка ленты...</p> : (
          feed.length > 0 ? (
            feed.map((item) => (
              <div key={item.id} className={styles.feedItem}>
                {/* --- ИЗМЕНЕНИЕ: Новая ссылка на логотип в ленте --- */}
                <img src="https://i.postimg.cc/FRbVhpK1/Frame-2131328056.webp" alt="feed item logo" className={styles.feedItemLogo} />
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
