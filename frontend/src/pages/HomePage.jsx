// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect } from 'react';
import { getFeed, getBanners } from '../api';
import styles from './HomePage.module.css';
import { getPreloadedData } from '../preloader';

function HomePage({ user, onNavigate, telegramPhotoUrl }) {
  // --- ИЗМЕНЕНИЕ: Пытаемся сразу получить ленту из кэша ---
  const [feed, setFeed] = useState(() => getPreloadedData('feed'));
  const [banners, setBanners] = useState([]);
  // --- ИЗМЕНЕНИЕ: Не показываем загрузку, если лента уже есть ---
  const [isLoading, setIsLoading] = useState(!feed);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    // --- ИЗМЕНЕНИЕ: Загружаем ленту, только если ее не было в кэше ---
    const fetchData = async () => {
      // Загружаем баннеры в любом случае
      const bannersResponse = await getBanners();
      setBanners(bannersResponse.data);

      // А ленту - только если ее нет
      if (!feed) {
        const feedResponse = await getFeed();
        setFeed(feedResponse.data);
      }
      setIsLoading(false); // Убираем индикатор загрузки
    };

    fetchData().catch(error => {
      console.error("Failed to fetch data for home page", error);
      setIsLoading(false);
    });
  }, [feed]);
  
  // --- НОВЫЙ ЭФФЕКТ: Логика для авто-переключения слайдов ---
  const mainBanners = banners.filter(b => b.position === 'main');
  
  useEffect(() => {
    if (mainBanners.length > 1) {
      const timer = setTimeout(() => {
        setCurrentSlide((prevSlide) => (prevSlide + 1) % mainBanners.length);
      }, 5000); // Переключаем каждые 5 секунд
      return () => clearTimeout(timer); // Очищаем таймер при смене компонента
    }
  }, [currentSlide, mainBanners.length]);

  const photoFeedBanners = banners.filter(b => b.position === 'feed');
  
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
          <span className={styles.userName}>{user.first_name}</span>
          <img 
            src="https://i.postimg.cc/ncfzjKGc/image.webp" 
            alt="Отправить спасибки" 
            className={styles.thankYouButton} 
            onClick={() => onNavigate('transfer')} 
          />
        </div>

{/* --- ИЗМЕНЕНИЕ: Переделываем блок в слайдер --- */}
        {mainBanners.length > 0 && (
          <div className={styles.sliderContainer}>
            <div 
              className={styles.sliderTrack}
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {mainBanners.map(banner => (
                <div key={banner.id} className={styles.slide} onClick={() => handleBannerClick(banner.link_url)}>
                  <img src={banner.image_url} alt="Banner" className={styles.bannerImage} />
                </div>
              ))}
            </div>
            {mainBanners.length > 1 && (
              <div className={styles.sliderDots}>
                {mainBanners.map((_, index) => (
                  <div 
                    key={index} 
                    className={`${styles.dot} ${currentSlide === index ? styles.dotActive : ''}`}
                    onClick={() => setCurrentSlide(index)}
                  ></div>
                ))}
              </div>
            )}
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
