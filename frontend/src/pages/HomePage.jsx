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
        // --- ИЗМЕНЕНИЕ: параллельно загружаем и ленту, и баннеры ---
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

 // --- ИЗМЕНЕНИЕ: Разделяем баннеры на основной и второстепенные ---
  const mainBanner = banners.length > 0 ? banners[0] : null;
  const photoFeedBanners = banners.length > 1 ? banners.slice(1) : [];

  const handleBannerClick = (url) => {
    if (url) {
      window.open(url, '_blank');
    }
  };
  
  const photoPlaceholders = [1, 2, 3];

  return (
    <div className={styles.pageContainer}>
        {/* ... (код шапки и блока пользователя без изменений) ... */}
        <div className={styles.header}></div>
        <div className={styles.contentArea}>
            <div className={styles.userBlock}>
              <img src={telegramPhotoUrl || 'placeholder.png'} alt="User" className={styles.userAvatar} />
              <span className={styles.userName}>{user.last_name}</span>
              <img src="https://i.postimg.cc/ncfzjKGc/image.webp" alt="Отправить спасибки" className={styles.thankYouButton} onClick={() => onNavigate('transfer')} />
            </div>

            {/* --- ИЗМЕНЕНИЕ: Динамический основной баннер --- */}
            {mainBanner && (
              <div className={styles.banner} onClick={() => handleBannerClick(mainBanner.link_url)}>
                <img src={mainBanner.image_url} alt="Banner" className={styles.bannerImage} />
              </div>
            )}

            {/* --- ИЗМЕНЕНИЕ: Динамическая лента баннеров --- */}
            {photoFeedBanners.length > 0 && (
              <div className={styles.photoFeed}>
                {photoFeedBanners.map(banner => (
                  <div key={banner.id} className={styles.photoPlaceholder} onClick={() => handleBannerClick(banner.link_url)}>
                      <img src={banner.image_url} alt="Photo feed banner" className={styles.photoFeedImage}/>
                  </div>
                ))}
              </div>
            )}
            
            {/* ... (код ленты активности без изменений) ... */}
            <div className={styles.feedSection}>
              {/* ... */}
            </div>
        </div>
    </div>
  );
}

export default HomePage;
