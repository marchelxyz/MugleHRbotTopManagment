// frontend/src/components/WinModal.jsx

import React, { useEffect, lazy, Suspense } from 'react';
import styles from './WinModal.module.css';
// --- ИСПРАВЛЕНИЕ 1: Импортируем .json файл ---
import animationData from '../assets/AnimatedSticker.json';

// Lazy loading для Lottie - загружается только когда модалка открыта
const Lottie = lazy(() => import('react-lottie-player'));

const WinModal = ({ prize, onClose }) => {
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 2500);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <Suspense fallback={<div style={{ width: 150, height: 150, margin: '0 auto' }} />}>
                    <Lottie
                        loop={false}
                        // --- ИСПРАВЛЕНИЕ 2: Используем animationData, который идеально работает с .json ---
                        animationData={animationData}
                        play
                        style={{ width: 150, height: 150, margin: '0 auto' }}
                    />
                </Suspense>
                <h2 className={styles.title}>Поздравляем!</h2>
                <p className={styles.subtitle}>Вы выиграли</p>
                <p className={styles.prize}>{prize} спасибок!</p>
            </div>
        </div>
    );
};

export default WinModal;
