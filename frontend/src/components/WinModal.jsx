// frontend/src/components/WinModal.jsx

import React, { useEffect } from 'react';
import Lottie from 'react-lottie-player';
import styles from './WinModal.module.css';
// --- ИСПРАВЛЕНИЕ 1: Импортируем .json файл ---
import animationData from '../assets/AnimatedSticker.json';

const WinModal = ({ prize, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <Lottie
                    loop={false}
                    // --- ИСПРАВЛЕНИЕ 2: Используем animationData, который идеально работает с .json ---
                    animationData={animationData}
                    play
                    style={{ width: 150, height: 150, margin: '0 auto' }}
                />
                <h2 className={styles.title}>Поздравляем!</h2>
                <p className={styles.subtitle}>Вы выиграли</p>
                <p className={styles.prize}>{prize} спасибок!</p>
            </div>
        </div>
    );
};

export default WinModal;
