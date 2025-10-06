// frontend/src/components/WinModal.jsx

import React, { useEffect } from 'react';
import Lottie from 'react-lottie-player';
import styles from './WinModal.module.css';

const WinModal = ({ prize, onClose }) => {
    // Автоматически закрываем окно через 4 секунды
    useEffect(() => {
        const timer = setTimeout(() => {
            onClose();
        }, 4000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={styles.backdrop} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <Lottie
                    loop={false}
                    animationData={null} // Lottie Player будет сам загружать по URL
                    path="/AnimatedSticker.tgs" // Путь к нашему файлу в папке /public
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
