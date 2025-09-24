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
    
    // --- ИСПРАВЛЕННАЯ ЛОГИКА АНИМАЦИИ ---
    const handleSpin = async () => {
        if (localUser.tickets < 1 || isSpinning) return;
        setIsSpinning(true);
        setWinAmount(null);
        
        // Сбрасываем барабаны для нового старта
        reelsRef.current.forEach(reel => {
            reel.style.transition = 'none';
        });

        try {
            const response = await spinRoulette();
            const { prize_won, new_balance, new_tickets } = response.data;
            const updatedUser = { ...localUser, balance: new_balance, tickets: new_tickets };
            
            const totalAnimationTime = 5000; // Общее время анимации в миллисекундах

            // Запускаем анимацию остановки для каждого барабана
            reelsRef.current.forEach((reel, index) => {
                const targetNumber = prize_won;
                const targetIndex = reelNumbers.indexOf(targetNumber);
                
                // Используем фиксированную высоту символа из CSS
                const symbolHeight = 120; 
                const totalSymbols = reelNumbers.length;
                
                // Рассчитываем конечную позицию
                // 5 полных оборотов + позиция выигрышного числа
                const totalDistance = 5 * totalSymbols * symbolHeight + (targetIndex * symbolHeight);
                
                // Устанавливаем transition с небольшой задержкой для каждого барабана
                const animationDuration = (totalAnimationTime / 1000) - (reelsRef.current.length - 1 - index) * 0.3;
                reel.style.transition = `transform ${animationDuration}s cubic-bezier(0.25, 1, 0.5, 1)`;
                reel.style.transform = `translateY(-${totalDistance}px)`;
            });

            // Обновляем состояние и историю ПОСЛЕ завершения всей анимации
            setTimeout(() => {
                setLocalUser(updatedUser);
                onUpdateUser(updatedUser);
                setWinAmount(prize_won);
                setIsSpinning(false);
                getRouletteHistory().then(res => setHistory(res.data));
            }, totalAnimationTime);

        } catch (error) {
            showAlert(error.response?.data?.detail || 'Ошибка прокрутки', 'error');
            setIsSpinning(false);
        }
    };

    return (
        <PageLayout title="Слот-машина">
            <div className={styles.slotMachine}>
                <div className={styles.reelsContainer}>
                    {[0, 1, 2].map(i => (
                        <div key={i} className={styles.reelWrapper}>
                            <div className={styles.reelTrack} ref={el => reelsRef.current[i] = el}>
                                {/* Создаем 10 копий чисел для очень длинной ленты, чтобы избежать "пропадания" */}
                                {Array(10).fill(reelNumbers).flat().map((number, index) => (
                                    <div key={index} className={styles.symbol}>
                                        {number}
                                    </div>
                                ))}
                            </div>
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
