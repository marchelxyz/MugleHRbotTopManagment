// frontend/src/components/Garland.jsx

import React, { useState, useEffect } from 'react';
import styles from './Garland.module.css';

function Garland() {
    // Базовый паттерн лампочек с разными цветами
    const baseBulbs = [
        { color: '#FF6B6B', delay: 0 },      // Красный
        { color: '#4ECDC4', delay: 0.2 },    // Бирюзовый
        { color: '#FFE66D', delay: 0.4 },    // Желтый
        { color: '#95E1D3', delay: 0.6 },    // Мятный
        { color: '#F38181', delay: 0.8 },    // Розовый
        { color: '#AA96DA', delay: 1.0 },    // Фиолетовый
        { color: '#FCBAD3', delay: 1.2 },    // Светло-розовый
        { color: '#FFD93D', delay: 1.4 },    // Золотой
        { color: '#6BCB77', delay: 1.6 },    // Зеленый
        { color: '#4D96FF', delay: 1.8 },   // Синий
        { color: '#FF6B9D', delay: 2.0 },    // Ярко-розовый
        { color: '#C44569', delay: 2.2 },    // Темно-розовый
        { color: '#F8B500', delay: 2.4 },    // Оранжевый
        { color: '#A8E6CF', delay: 2.6 },    // Светло-зеленый
        { color: '#FFD3A5', delay: 2.8 },    // Персиковый
        { color: '#FD9853', delay: 3.0 },    // Коралловый
    ];

    // Базовая ширина одного сегмента гирлянды (в пикселях)
    const SEGMENT_WIDTH = 1000;
    const BULBS_PER_SEGMENT = baseBulbs.length;

    const [bulbs, setBulbs] = useState([]);
    const [segmentsCount, setSegmentsCount] = useState(1);

    useEffect(() => {
        const updateBulbs = () => {
            const screenWidth = window.innerWidth;
            // Вычисляем количество сегментов для заполнения экрана
            const count = Math.ceil(screenWidth / SEGMENT_WIDTH);
            setSegmentsCount(count);

            // Генерируем лампочки для всех сегментов
            const allBulbs = [];
            for (let segment = 0; segment < count; segment++) {
                baseBulbs.forEach((bulb, index) => {
                    const globalIndex = segment * BULBS_PER_SEGMENT + index;
                    // Позиция внутри сегмента (от 0 до 1)
                    const positionInSegment = index / (BULBS_PER_SEGMENT - 1);
                    // Абсолютная позиция на всем экране (от 0 до 1)
                    const absolutePosition = (segment + positionInSegment) / count;
                    
                    allBulbs.push({
                        ...bulb,
                        key: globalIndex,
                        position: absolutePosition * 100,
                        // Добавляем смещение для анимации, чтобы каждый сегмент имел свою задержку
                        delay: bulb.delay + (segment * 3.2),
                    });
                });
            }
            setBulbs(allBulbs);
        };

        updateBulbs();
        window.addEventListener('resize', updateBulbs);
        return () => window.removeEventListener('resize', updateBulbs);
    }, []);

    // Создаем массив сегментов провода
    const wireSegments = Array.from({ length: segmentsCount }, (_, i) => i);

    return (
        <div className={styles.garland}>
            <div className={styles.wireContainer}>
                {wireSegments.map((segment) => (
                    <svg 
                        key={segment}
                        className={styles.wire}
                        viewBox="0 0 1000 50"
                        preserveAspectRatio="none"
                        style={{
                            width: `${100 / segmentsCount}%`,
                            left: `${(segment * 100) / segmentsCount}%`,
                        }}
                    >
                        <path
                            d="M 0,25 Q 250,5 500,25 T 1000,25"
                            fill="none"
                            stroke="#FFD700"
                            strokeWidth="2"
                            className={styles.wirePath}
                        />
                    </svg>
                ))}
            </div>
            <div className={styles.bulbsContainer}>
                {bulbs.map((bulb) => (
                    <div
                        key={bulb.key}
                        className={styles.bulbWrapper}
                        style={{
                            left: `${bulb.position}%`,
                        }}
                    >
                        <div
                            className={styles.bulb}
                            style={{
                                '--bulb-color': bulb.color,
                                '--animation-delay': `${bulb.delay}s`,
                            }}
                        >
                            <div className={styles.bulbGlow}></div>
                            <div className={styles.bulbCore}></div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

export default Garland;
