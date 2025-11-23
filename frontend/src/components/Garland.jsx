// frontend/src/components/Garland.jsx

import React from 'react';
import styles from './Garland.module.css';

function Garland() {
    // Создаем массив лампочек с разными цветами
    const bulbs = [
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

    return (
        <div className={styles.garland}>
            <svg className={styles.wire} viewBox="0 0 1000 50" preserveAspectRatio="none">
                <path
                    d="M 0,25 Q 250,5 500,25 T 1000,25"
                    fill="none"
                    stroke="#FFD700"
                    strokeWidth="2"
                    className={styles.wirePath}
                />
            </svg>
            <div className={styles.bulbsContainer}>
                {bulbs.map((bulb, index) => (
                    <div
                        key={index}
                        className={styles.bulbWrapper}
                        style={{
                            left: `${(index / (bulbs.length - 1)) * 100}%`,
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
