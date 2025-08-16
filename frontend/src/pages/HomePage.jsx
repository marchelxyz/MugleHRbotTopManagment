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
    <div className={styles.pageContainer}>
      <div className={styles.header}></div>

      <div className={styles.contentArea}>
        
        <div className={styles.userBlock}>
          <img src={telegramPhotoUrl || 'placeholder.png'} alt="User" className={styles.userAvatar} />
          <span className={styles.userName}>{user.last_name}</span>
          <img 
            src="https://i.postimg.cc/ncfzjKGc/image.webp" 
            alt="Отправить спасибки" 
            className={styles.thankYouButton} 
            onClick={() => onNavigate('transfer')} 
          />
        </div>

        <div className={styles.banner}>
          <img src="https://i.postimg.cc/kD31TGDt/234.webp" alt="Banner" className={styles.bannerImage} />
        </div>

        <div className={styles.photoFeed}>
          {photoPlaceholders.map(p => <div key={p} className={styles.photoPlaceholder}></div>)}
        </div>

        <div className={styles.feedSection}>
          <h3 className={styles.feedTitle}>Последняя активность</h3>
          <div className={styles.feedGrid}>
            {isLoading ? <p>Загрузка...</p> : (
              feed.map((item) => (
                <div key={item.id} className={styles.feedItem}>
                  <img src="https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp" alt="feed logo" className={styles.feedItemLogo} />
                  <div className={styles.feedItemContent}>
                    <p className={styles.feedTransaction}>
                      @{item.sender.username || item.sender.last_name} <span className={styles.arrow}>&rarr;</span> @{item.receiver.username || item.receiver.last_name}
                    </p>
                    <p className={styles.feedMessage}>{item.amount} спасибо - {item.message}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default HomePage;
