// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { getFeed, getBanners } from '../api';
import styles from './HomePage.module.css';
import { getCachedData } from '../storage';
import { formatToMsk, formatFeedDate } from '../utils/dateFormatter';
// --- 1. ДОБАВЛЕН ИМПОРТ ---
import LeaderboardBanner from '../components/LeaderboardBanner';
import Garland from '../components/Garland';

function HomePage({ user, onNavigate, telegramPhotoUrl, isDesktop }) {
    const [feed, setFeed] = useState(() => getCachedData('feed'));
    const [banners, setBanners] = useState(() => getCachedData('banners') || []);
    const [isLoading, setIsLoading] = useState(!feed);
    const [currentSlide, setCurrentSlide] = useState(0);

    useEffect(() => {
        const fetchData = async () => {
            // Загружаем banners только если их нет в кэше
            if (!banners || banners.length === 0) {
                try {
                    const bannersResponse = await getBanners();
                    setBanners(bannersResponse.data);
                } catch (error) {
                    console.error("Failed to fetch banners", error);
                }
            }
            // Загружаем feed только если его нет в кэше
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
    }, [feed, banners]);

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

    // --- 2. ОБНОВЛЕНА ФУНКЦИЯ КЛИКА ---
    const handleBannerClick = (url) => {
        if (!url) return;
        
        if (url.startsWith('/')) {
            // Это внутренняя ссылка, используем onNavigate
            onNavigate(url.replace('/', '')); // '/leaderboard' -> 'leaderboard'
        } else {
            // Это внешняя ссылка, открываем в браузере
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

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

    // --- (Твой код, оставлен без изменений) ---
    const getSliderTransform = () => {
      // Для мобильных устройств логика остаётся прежней
      if (!isDesktop) {
        return `translateX(-${currentSlide * 100}%)`;
      }
      
      // Для ПК используем новую, более простую математику
      // Один слайд занимает 80% ширины + по 2% отступа с каждой стороны = 84%
      const slideTotalWidth = 84; 
      // Чтобы отцентрировать первый слайд (80%), нужно оставить по 10% по бокам.
      // Так как у нас уже есть отступ 2%, начальный сдвиг должен быть 8%.
      const initialOffset = 8;
      
      const offset = initialOffset - (currentSlide * slideTotalWidth);
      return `translateX(${offset}%)`;
    };
    // --- (Конец твоего кода) ---

    return (
        <div className={styles.pageContainer}>
            {/* Дополнительные слои снега */}
            <div className={styles.extraSnow1}></div>
            <div className={styles.extraSnow2}></div>
            <div className={styles.extraSnow3}></div>
            <div className={styles.headerWrapper}>
                {/* Гирлянда */}
                <Garland />
                <div className={isDesktop ? styles.headerDesktop : styles.header}></div>
            </div>
            <div className={styles.contentArea}>
                <div className={styles.userBlock}>
                    <img src={telegramPhotoUrl || 'placeholder.png'} alt="User" className={styles.userAvatar} />
                    <span className={styles.userName}>{user.first_name}</span>
                    <img
                        src="https://i.postimg.cc/kgrZQyKK/knopka-otpr-sp-sinaa.webp"
                        alt="Отправить спасибки"
                        className={styles.thankYouButton}
                        onClick={() => onNavigate('transfer')}
                    />
                </div>

                {mainBanners.length > 0 && (
                    <div className={styles.sliderContainer}>
                        <div 
                            className={styles.sliderTrack}
                            style={{ transform: getSliderTransform() }}
                        >
                            {/* --- 3. ОБНОВЛЕНА ЛОГИКА РЕНДЕРИНГА СЛАЙДОВ --- */}
                            {mainBanners.map((banner, index) => (
                                <div 
                                    key={banner.id} 
                                    className={`${styles.slide} ${currentSlide === index ? styles.active : ''}`}
                                    // Клик обрабатывается только если это баннер-картинка
                                    // (У баннера-рейтинга своя кнопка внутри)
                                    onClick={() => (banner.banner_type === 'image' || !banner.banner_type) && handleBannerClick(banner.link_url)}
                                >
                                    {/* Условный рендеринг: Картинка ИЛИ Компонент */}
                                    {(banner.banner_type === 'image' || !banner.banner_type) ? (
                                        // Старая логика, если это 'image' или тип не указан
                                        <img src={banner.image_url} alt="Banner" className={styles.bannerImage} />
                                    ) : (
                                        // Новая логика для других типов (leaderboard_...)
                                        <LeaderboardBanner 
                                            banner={banner} 
                                            onNavigate={onNavigate} 
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                        
                        {/* (Этот блок у тебя был, он на месте) */}
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

                {/* (Весь остальной код твой, оставлен без изменений) */}
                {photoFeedBanners.length > 0 && (
                    <div className={styles.photoFeed}>
                        {/* Дублируем массив для создания бесшовной анимации */}
                        <div className={styles.photoFeedTrack}>
                            {[...photoFeedBanners, ...photoFeedBanners].map((banner, index) => (
                                <div key={`${banner.id}-${index}`} className={styles.photoPlaceholder} onClick={() => handleBannerClick(banner.link_url)}>
                                    <img src={banner.image_url} alt="Photo feed banner" className={styles.photoFeedImage} loading="lazy"/>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className={styles.feedSection}>
                    <h3 className={styles.feedTitle}>Последняя активность</h3>
                    <div className={styles.feedGrid}>
                        {isLoading ? <p>Загрузка...</p> : (
                            Object.keys(groupedFeed).length > 0 ? (
                                // --- 3. ИЗМЕНЕНИЕ: Отрисовываем сгруппированную ленту ---
                                Object.keys(groupedFeed).map(dateKey => (
                                    <React.Fragment key={dateKey}>
                                        <div className={styles.dateHeader}>
                                            <span>{formatFeedDate(groupedFeed[dateKey][0].timestamp)}</span>
                                        </div>
                                        {groupedFeed[dateKey].map(item => (
                                            <div key={item.id} className={styles.feedItem}>
                                                <img src="https://i.postimg.cc/L5j1PRjr/LOGO-SP-UVED-SIN.webp" alt="feed logo" className={styles.feedItemLogo} loading="lazy" />
                                                <div className={styles.feedItemContent}>
                                                    <p className={styles.feedTransaction}>
                                                        @{item.sender?.username || item.sender?.last_name || 'Неизвестно'} <span className={styles.arrow}>&rarr;</span> @{item.receiver?.username || item.receiver?.last_name || 'Неизвестно'}
                                                    {/* --- !!! ВОТ ИСПРАВЛЕНИЕ ОПЕЧАТКИ !!! --- */}
                                                    </p>
                                                    <p className={styles.feedMessage}>{item.amount} спасибо - {item.message}</p>
                                                </div>
                                                <div className={styles.feedTimestamp}>
                                                    {/* Показываем только время */}
                                                    {formatToMsk(item.timestamp, { year: undefined, month: undefined, day: undefined })}
                                                </div>
                                            </div>
                                        ))}
                                    </React.Fragment>
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
