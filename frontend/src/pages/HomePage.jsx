// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { getFeed, getBanners } from '../api';
import styles from './HomePage.module.css';
import { getCachedData } from '../storage';
// --- 1. Убедимся, что импортируем обе функции ---
import { formatToMsk, formatFeedDate } from '../utils/dateFormatter';

function HomePage({ user, onNavigate, telegramPhotoUrl, isDesktop }) {
    const [feed, setFeed] = useState(() => getCachedData('feed'));
    const [banners, setBanners] = useState([]);
    const [isLoading, setIsLoading] = useState(!feed);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            const bannersResponse = await getBanners();
            setBanners(bannersResponse.data);
            if (!feed) {
                try {
                    const feedResponse = await getFeed();
                    setFeed(feedResponse.data);
                } catch (error) {
                    console.error("Failed to fetch feed", error);
                }
            }
            setIsLoading(false);
        };
        fetchData();
    }, [feed]);

    const mainBanners = banners.filter(b => b.position === 'main');

    useEffect(() => {
        if (mainBanners.length > 1) {
            const timer = setTimeout(() => {
                setCurrentSlide((prevSlide) => (prevSlide + 1) % mainBanners.length);
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [currentSlide, mainBanners.length]);

    const photoFeedBanners = banners.filter(b => b.position === 'feed');

    const handleBannerClick = (url) => {
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    // --- 2. НОВАЯ ЛОГИКА: Группируем ленту по дням ---
    const groupedFeed = useMemo(() => {
        if (!feed || feed.length === 0) return {};
        return feed.reduce((acc, item) => {
            const dateKey = formatToMsk(item.timestamp, { year: undefined, month: undefined, day: undefined, hour: undefined, minute: undefined });
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(item);
            return acc;
        }, {});
    }, [feed]);

    return (
        <div className={styles.pageContainer}>
            <div className={isDesktop ? styles.headerDesktop : styles.header}></div>
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
                
            <div className={styles.feedSection}>
                <h3 className={styles.feedTitle}>Последняя активность</h3>
                <div className={styles.feedContainer}> {/* Используем flex-контейнер для дней */}
                    {isLoading ? <p>Загрузка...</p> : (
                        Object.keys(groupedFeed).length > 0 ? (
                            Object.keys(groupedFeed).map(dateKey => (
                                <div key={dateKey} className={styles.dayGroup}>
                                    <div className={styles.dateHeader}>
                                        <span>{formatFeedDate(groupedFeed[dateKey][0].timestamp)}</span>
                                    </div>
                                    <div className={styles.feedGrid}>
                                        {groupedFeed[dateKey].map(item => (
                                            <div key={item.id} className={styles.feedItem}>
                                                <img src="https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp" alt="feed logo" className={styles.feedItemLogo} />
                                                <div className={styles.feedItemContent}>
                                                    <p className={styles.feedTransaction}>
                                                        @{item.sender.username || item.sender.last_name} <span className={styles.arrow}>&rarr;</span> @{item.receiver.username || item.receiver.last_name}
                                                    </p>
                                                    <p className={styles.feedMessage}>{item.amount} спасибо - {item.message}</p>
                                                </div>
                                                <div className={styles.feedTimestamp}>
                                                    {formatToMsk(item.timestamp, { year: undefined, month: undefined, day: undefined })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        ) : <p>Лента активности пуста.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default HomePage;
