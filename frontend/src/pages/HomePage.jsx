// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect } from 'react';
import { getFeed, getBanners } from '../api';
import styles from './HomePage.module.css';

function HomePage({ user, onNavigate, telegramPhotoUrl }) {
  const [feed, setFeed] = useState([]);
  const [banners, setBanners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [feedResponse, bannersResponse] = await Promise.all([
          getFeed(),
          getBanners()
        ]);
        setFeed(feedResponse.data);
        setBanners(bannersResponse.data);
      } catch (error) {
        console.error("Failed to fetch data for home page", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Логика остаётся прежней: первый баннер — основной, остальные — в карусель.
  const mainBanner = banners.length > 0 ? banners[0] : null;
  const photoFeedBanners = banners.length > 1 ? banners.slice(1) : [];

  const handleBannerClick = (url) => {
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

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

        {/* Основной баннер */}
        {mainBanner && (
          <div className={styles.banner} onClick={() => handleBannerClick(mainBanner.link_url)}>
            <img src={mainBanner.image_url} alt="Banner" className={styles.bannerImage} />
          </div>
        )}

        {/* --- ИЗМЕНЕНИЕ: Горизонтальная лента баннеров --- */}
        {photoFeedBanners.length > 0 && (
          <div className={styles.photoFeed}>
            {/* Дублируем массив для создания бесшовной анимации */}
            <div className={styles.photoFeedTrack}>
              {[...photoFeedBanners, ...photoFeedBanners].map((banner, index) => (
                <div key={`${banner.id}-${index}`} className={styles.photoPlaceholder} onClick={() => handleBannerClick(banner.link_url)}>
                  <img src={banner.image_url} alt="Photo feed banner" className={styles.photoFeedImage}/>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* --- ИСПРАВЛЕНИЕ: ВОССТАНАВЛИВАЕМ ПРОПАВШИЙ БЛОК --- */}
        <div className={styles.feedSection}>
          <h3 className={styles.feedTitle}>Последняя активность</h3>
          <div className={styles.feedGrid}>
            {isLoading ? <p>Загрузка...</p> : (
              feed.length > 0 ? (
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
              ) : <p>Лента активности пуста.</p>
            )}
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default HomePage;
