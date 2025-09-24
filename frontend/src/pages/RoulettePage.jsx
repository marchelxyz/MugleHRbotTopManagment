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
    // Используем Ref для хранения колбэка, чтобы избежать лишних перерисовок
    const onAnimationEndRef = useRef(null); 


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
    
    // --- НОВАЯ УЛУЧШЕННАЯ ЛОГИКА АНИМАЦИИ ---
    const handleSpin = async () => {
        if (localUser.tickets < 1 || isSpinning) return;
        setIsSpinning(true);
        setWinAmount(null);
        
        reelsRef.current.forEach(reel => {
            reel.style.transition = 'none';
            const randomOffset = Math.floor(Math.random() * reelNumbers.length);
            const symbolHeight = 120;
            reel.style.transform = `translateY(-${randomOffset * symbolHeight}px)`;
        });

        try {
            const response = await spinRoulette();
            const { prize_won, new_balance, new_tickets } = response.data;
            const updatedUser = { ...localUser, balance: new_balance, tickets: new_tickets };
            
            // Задаем колбэк, который выполнится ПОСЛЕ завершения анимации
            onAnimationEndRef.current = () => {
                setLocalUser(updatedUser);
                onUpdateUser(updatedUser);
                setWinAmount(prize_won);
                setIsSpinning(false);
                getRouletteHistory().then(res => setHistory(res.data));
            };

            // Запускаем анимацию остановки для каждого барабана
            reelsRef.current.forEach((reel, index) => {
                const targetNumber = prize_won; // Все барабаны останавливаются на выигрышном числе
                const targetIndex = reelNumbers.indexOf(targetNumber);
                
                const symbolHeight = 120;
                const totalHeight = reel.scrollHeight;
                const loops = 4;
                const finalPosition = (loops * totalHeight / 2) + (targetIndex * symbolHeight);

                // Добавляем небольшую задержку для старта, чтобы сброс transform успел примениться
                setTimeout(() => {
                    reel.style.transition = `transform ${4 + index * 0.5}s cubic-bezier(.32, .95, .46, 1)`;
                    reel.style.transform = `translateY(-${finalPosition}px)`;
                }, 100);

                // Назначаем обработчик события окончания анимации только на последний, самый долгий барабан
                if (index === reelsRef.current.length - 1) {
                    reel.addEventListener('transitionend', onAnimationEndRef.current, { once: true });
                }
            });

        } catch (error) {
            showAlert(error.response?.data?.detail || 'Ошибка прокрутки', 'error');
            setIsSpinning(false);
        }
    };


    return (
        <PageLayout title="Слот-машина">
            <div className={styles.slotMachineWrapper}>
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
