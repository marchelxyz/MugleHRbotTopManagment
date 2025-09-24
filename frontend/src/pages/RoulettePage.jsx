// frontend/src/pages/RoulettePage.jsx

import React, { useState, useEffect, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import { spinRoulette, assembleTickets, getRouletteHistory } from '../api';
import styles from './RoulettePage.module.css';
import { useModalAlert } from '../contexts/ModalAlertContext';

const reelNumbers = Array.from({ length: 30 }, (_, i) => i + 1);

function RoulettePage({ user, onUpdateUser }) {
    const { showAlert } = useModalAlert();
    const [localUser, setLocalUser] = useState(user);
    const [history, setHistory] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [winAmount, setWinAmount] = useState(null);

    const reelsRef = useRef([]);

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await getRouletteHistory();
                setHistory(res.data);
            } catch (error) { console.error("Не удалось обновить историю рулетки:", error); }
        };
        fetchHistory();
        const intervalId = setInterval(fetchHistory, 5000);
        return () => clearInterval(intervalId);
    }, []);

    const handleAssemble = async () => {
        if (localUser.ticket_parts < 2) return;
        try {
            const response = await assembleTickets();
            setLocalUser(response.data);
            onUpdateUser(response.data);
            showAlert('Билет собран!', 'success');
        } catch (error) {
            showAlert(error.response?.data?.detail || 'Ошибка сборки', 'error');
        }
    };
    
    // --- ФИНАЛЬНАЯ ВЕРСИЯ ЛОГИКИ АНИМАЦИИ ---
    const handleSpin = async () => {
        if (localUser.tickets < 1 || isSpinning) return;
        setIsSpinning(true);
        setWinAmount(null);
        
        // Запускаем бесконечную анимацию вращения
        reelsRef.current.forEach(reel => reel.classList.add(styles.spinning));

        try {
            const response = await spinRoulette();
            const { prize_won, new_balance, new_tickets } = response.data;
            const updatedUser = { ...localUser, balance: new_balance, tickets: new_tickets };
            
            // Функция для остановки барабанов
            const stopReels = () => {
                reelsRef.current.forEach((reel, index) => {
                    // Убираем класс бесконечной анимации
                    reel.classList.remove(styles.spinning);
                    
                    const targetNumber = prize_won;
                    const targetIndex = reelNumbers.indexOf(targetNumber);
                    
                    const symbolHeight = reel.querySelector(`.${styles.symbol}`).offsetHeight;
                    const totalHeight = reel.scrollHeight;

                    // Рассчитываем позицию для плавной остановки
                    // (несколько оборотов + финальная позиция)
                    const basePosition = (totalHeight / 2) - (targetIndex * symbolHeight);
                    const currentTransform = window.getComputedStyle(reel).transform;
                    const matrix = new DOMMatrixReadOnly(currentTransform);
                    const currentY = matrix.m42;
                    const loops = 2;
                    const finalPosition = basePosition - (totalHeight * loops) - currentY;
                    
                    reel.style.transition = `transform ${2 + index * 0.5}s cubic-bezier(0.25, 1, 0.5, 1)`;
                    reel.style.transform = `translateY(${finalPosition}px)`;
                });

                // Когда анимация последнего барабана закончится, обновляем все данные
                const lastReel = reelsRef.current[reelsRef.current.length - 1];
                lastReel.addEventListener('transitionend', () => {
                    setLocalUser(updatedUser);
                    onUpdateUser(updatedUser);
                    setWinAmount(prize_won);
                    setIsSpinning(false);
                    // Обновляем историю в самом конце
                    setTimeout(() => getRouletteHistory().then(res => setHistory(res.data)), 100);
                }, { once: true });
            };

            // Запускаем остановку через небольшую задержку, чтобы вращение было заметно
            setTimeout(stopReels, 1000);

        } catch (error) {
            showAlert(error.response?.data?.detail || 'Ошибка прокрутки', 'error');
            reelsRef.current.forEach(reel => reel.classList.remove(styles.spinning));
            setIsSpinning(false);
        }
    };


    return (
        <PageLayout title="Слот-машина">
            <div className={styles.slotMachine}>
                <div className={`${styles.shadow} ${styles.topShadow}`}></div>
                <div className={`${styles.shadow} ${styles.bottomShadow}`}></div>
                
                <div className={styles.reelsContainer}>
                    {[0, 1, 2].map(i => (
                        <div key={i} className={styles.reelWrapper}>
                            <div className={styles.reelTrack} ref={el => reelsRef.current[i] = el}>
                                {[...reelNumbers, ...reelNumbers].map((number, index) => (
                                    <div key={index} className={styles.symbol}>
                                        {number}
                                    </div>
                                ))}
                            </div>
                            <div className={`${styles.shadow} ${styles.reelShadow}`}></div>
                        </div>
                    ))}
                </div>
            </div>
            
            {winAmount !== null && <div className={styles.winMessage}>Выигрыш {winAmount} спасибок! 🎉</div>}
            
            <button 
              className={`${styles.spinButton} ${isSpinning ? styles.spinning : ''}`} 
              onClick={handleSpin} 
              disabled={isSpinning || localUser.tickets < 1}
            >
                SPIN
            </button>
            
            <div className={styles.history}>
                <h3>Последние победители</h3>
                {history.length > 0 ? history.map(win => (
                    <div key={win.id} className={styles.historyItem}>
                        <span>{win.user.first_name}</span>
                        <strong>выиграл(а) {win.amount} спасибок</strong>
                    </div>
                )) : <p>Пока никто не выигрывал.</p>}
            </div>
        </PageLayout>
    );
}

export default RoulettePage;
