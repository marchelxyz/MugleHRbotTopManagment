// frontend/src/pages/RoulettePage.jsx

import React, { useState, useEffect, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import { spinRoulette, assembleTickets, getRouletteHistory } from '../api';
import styles from './RoulettePage.module.css';
import { FaInfoCircle } from 'react-icons/fa';
import { useModalAlert } from '../contexts/ModalAlertContext';

const thankYouIcon = "https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp";
const ticketIcon = "https://i.postimg.cc/pX05sN69/ticket-icon.png";
const jackpotIcon = "https://i.postimg.cc/W3B9pG1c/jackpot-icon.png";

const PRIZES = {
    1: thankYouIcon, 2: thankYouIcon, 3: thankYouIcon, 4: thankYouIcon, 5: thankYouIcon,
    6: ticketIcon, 8: ticketIcon, 9: ticketIcon, 10: ticketIcon, 11: ticketIcon, 12: ticketIcon, 13: ticketIcon, 14: ticketIcon, 15: ticketIcon,
    16: jackpotIcon, 17: jackpotIcon, 18: jackpotIcon, 19: jackpotIcon, 20: jackpotIcon, 21: jackpotIcon, 22: jackpotIcon, 23: jackpotIcon, 24: jackpotIcon, 25: jackpotIcon, 26: jackpotIcon, 27: jackpotIcon, 28: jackpotIcon, 29: jackpotIcon, 30: jackpotIcon
};

const reelSymbols = [thankYouIcon, ticketIcon, jackpotIcon, ticketIcon, thankYouIcon, jackpotIcon, ticketIcon];

function RoulettePage({ user, onUpdateUser }) {
    const { showAlert } = useModalAlert();
    const [localUser, setLocalUser] = useState(user);
    const [history, setHistory] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [infoVisible, setInfoVisible] = useState(false);
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
    
    // --- НОВАЯ, УЛУЧШЕННАЯ ЛОГИКА ВРАЩЕНИЯ ---
    const handleSpin = async () => {
        if (localUser.tickets < 1 || isSpinning) return;
        setIsSpinning(true);
        setWinAmount(null);
        
        // Сбрасываем барабаны в начальное положение
        reelsRef.current.forEach(reel => {
            reel.style.transition = 'none';
            reel.style.transform = `translateY(0)`;
        });

        // Запускаем бесконечную анимацию вращения через CSS
        reelsRef.current.forEach(reel => reel.classList.add(styles.spinning));

        try {
            const response = await spinRoulette();
            const { prize_won, new_balance, new_tickets } = response.data;
            const updatedUser = { ...localUser, balance: new_balance, tickets: new_tickets };
            
            // Получаем иконку нашего приза
            const prizeIcon = PRIZES[prize_won];

            // Начинаем останавливать барабаны по очереди
            const stopReel = (reelIndex) => {
                if (reelIndex >= reelsRef.current.length) {
                    // Все барабаны остановлены
                    setLocalUser(updatedUser);
                    onUpdateUser(updatedUser);
                    setWinAmount(prize_won);
                    setIsSpinning(false);
                    getRouletteHistory().then(res => setHistory(res.data));
                    return;
                }

                const reel = reelsRef.current[reelIndex];
                const isCenterReel = reelIndex === 1;
                
                // Выбираем иконку: для центрального - призовую, для остальных - случайную
                const targetIcon = isCenterReel ? prizeIcon : reelSymbols[Math.floor(Math.random() * reelSymbols.length)];
                const targetIndex = reelSymbols.indexOf(targetIcon);
                
                // Рассчитываем позицию
                const symbolHeight = reel.querySelector(`.${styles.symbol}`).offsetHeight;
                const totalHeight = reel.scrollHeight;
                const basePosition = (totalHeight / 2) - (targetIndex * symbolHeight);
                const currentTransform = window.getComputedStyle(reel).transform;
                const matrix = new DOMMatrixReadOnly(currentTransform);
                const currentY = matrix.m42;

                // Убираем класс бесконечной анимации
                reel.classList.remove(styles.spinning);
                reel.style.transition = 'none'; // Сбрасываем transition для точного позиционирования
                
                // Устанавливаем барабан в позицию чуть "выше" выигрышной
                const preStopPosition = basePosition - totalHeight/2;
                reel.style.transform = `translateY(${preStopPosition}px)`;
                
                // И плавно "докручиваем" до нужной иконки
                setTimeout(() => {
                    reel.style.transition = 'transform 1.5s cubic-bezier(0.25, 1, 0.5, 1)';
                    reel.style.transform = `translateY(${basePosition}px)`;
                }, 50);

                // Запускаем остановку следующего барабана с задержкой
                setTimeout(() => stopReel(reelIndex + 1), 500); // Задержка 0.5 секунды
            };

            // Запускаем процесс остановки первого барабана
            stopReel(0);

        } catch (error) {
            showAlert(error.response?.data?.detail || 'Ошибка прокрутки', 'error');
            reelsRef.current.forEach(reel => reel.classList.remove(styles.spinning));
            setIsSpinning(false);
        }
    };


    return (
        <PageLayout title="Слот-машина">
            <div className={styles.infoIcon} onClick={() => setInfoVisible(!infoVisible)}><FaInfoCircle /></div>
            {infoVisible && (
                <div className={styles.infoModal}>
                    <p>Отправляйте "спасибки", чтобы получать части билетов (1 перевод = 1 часть).</p>
                    <p>Соберите 2 части, чтобы получить 1 билет для игры.</p>
                </div>
            )}

            <div className={styles.userBalance}>
                <div className={styles.balanceBox}>
                    <span>Части билетов</span>
                    <strong>{localUser.ticket_parts} / 2</strong>
                </div>
                <button onClick={handleAssemble} disabled={localUser.ticket_parts < 2}>Собрать</button>
                <div className={styles.balanceBox}>
                    <span>Билеты</span>
                    <strong>{localUser.tickets}</strong>
                </div>
            </div>

            <div className={styles.slotMachineWrapper}>
                <div className={styles.slotMachine}>
                    <div className={styles.slotGloss}></div>
                    <div className={styles.slotScreen}>
                        <div className={styles.reelsContainer}>
                            {[0, 1, 2].map(i => (
                                <div key={i} className={styles.reel}>
                                    <div className={styles.reelTrack} ref={el => reelsRef.current[i] = el}>
                                        {[...reelSymbols, ...reelSymbols].map((symbol, index) => (
                                            <div key={index} className={styles.symbol}>
                                                <img src={symbol} alt="symbol" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <button className={styles.spinButton} onClick={handleSpin} disabled={isSpinning || localUser.tickets < 1}>
                    SPIN
                </button>
            </div>
            
            {winAmount !== null && <div className={styles.winMessage}>Вы выиграли {winAmount} спасибок! 🎉</div>}
            
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
