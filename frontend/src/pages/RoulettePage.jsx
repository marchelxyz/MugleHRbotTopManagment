// frontend/src/pages/RoulettePage.jsx

import React, { useState, useEffect, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import { spinRoulette, assembleTickets, getRouletteHistory } from '../api';
import styles from './RoulettePage.module.css';
import { FaInfoCircle } from 'react-icons/fa';
import { useModalAlert } from '../contexts/ModalAlertContext';

// --- НАШИ НОВЫЕ АССЕТЫ ДЛЯ СЛОТ-МАШИНЫ ---
const thankYouIcon = "https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp"; // "Спасибо"
const ticketIcon = "https://i.postimg.cc/pX05sN69/ticket-icon.png"; // Билет
const jackpotIcon = "https://i.postimg.cc/W3B9pG1c/jackpot-icon.png"; // Джекпот

// --- ПРИЗЫ И ИХ ИКОНКИ ---
const PRIZES = {
    // Маленькие призы (чаще всего)
    1: thankYouIcon, 2: thankYouIcon, 3: thankYouIcon, 4: thankYouIcon, 5: thankYouIcon,
    // Средние призы (реже)
    6: ticketIcon, 8: ticketIcon, 9: ticketIcon, 10: ticketIcon, 11: ticketIcon, 12: ticketIcon, 13: ticketIcon, 14: ticketIcon, 15: ticketIcon,
    // Крупные призы (очень редко)
    16: jackpotIcon, 17: jackpotIcon, 18: jackpotIcon, 19: jackpotIcon, 20: jackpotIcon, 21: jackpotIcon, 22: jackpotIcon, 23: jackpotIcon, 24: jackpotIcon, 25: jackpotIcon, 26: jackpotIcon, 27: jackpotIcon, 28: jackpotIcon, 29: jackpotIcon, 30: jackpotIcon
};

// Все возможные иконки для анимации
const reelSymbols = [thankYouIcon, ticketIcon, jackpotIcon, thankYouIcon, ticketIcon];

function RoulettePage({ user, onUpdateUser }) {
    const { showAlert } = useModalAlert();
    const [localUser, setLocalUser] = useState(user);
    const [history, setHistory] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [infoVisible, setInfoVisible] = useState(false);
    const [winAmount, setWinAmount] = useState(null);

    // Ссылки на DOM-элементы барабанов
    const reel1Ref = useRef(null);
    const reel2Ref = useRef(null);
    const reel3Ref = useRef(null);
    const leverRef = useRef(null);

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

    const handleSpin = async () => {
        if (localUser.tickets < 1 || isSpinning) return;
        setIsSpinning(true);
        setWinAmount(null);

        // Анимация рычага
        leverRef.current.classList.add(styles.leverPulled);

        // Запускаем вращение
        const reels = [reel1Ref.current, reel2Ref.current, reel3Ref.current];
        reels.forEach(reel => {
            reel.style.transition = 'none'; // Сбрасываем transition для мгновенного "сброса"
            reel.style.transform = `translateY(0)`;
        });

        // Небольшая задержка, чтобы браузер успел применить сброс
        setTimeout(async () => {
            reels.forEach(reel => {
                reel.style.transition = 'transform 4s cubic-bezier(0.25, 1, 0.5, 1)';
                // Устанавливаем конечное положение далеко внизу
                const randomOffset = Math.floor(Math.random() * reelSymbols.length);
                const totalHeight = reel.scrollHeight;
                const finalPosition = totalHeight - ((totalHeight / reelSymbols.length) * (randomOffset + 1));
                reel.style.transform = `translateY(-${finalPosition}px)`;
            });

            try {
                const response = await spinRoulette();
                const { prize_won, new_balance, new_tickets } = response.data;
                const updatedUser = { ...localUser, balance: new_balance, tickets: new_tickets };
                
                // Ждем окончания основной анимации
                setTimeout(() => {
                    setLocalUser(updatedUser);
                    onUpdateUser(updatedUser);
                    setWinAmount(prize_won);
                    
                    // "Докручиваем" центральный барабан до выигрышной иконки
                    const prizeIcon = PRIZES[prize_won];
                    const prizeIndex = reelSymbols.lastIndexOf(prizeIcon); // Находим индекс нужной иконки
                    
                    const iconHeight = reel2Ref.current.scrollHeight / reelSymbols.length;
                    const stopPosition = prizeIndex * iconHeight;

                    reel2Ref.current.style.transition = 'transform 1s ease-out';
                    reel2Ref.current.style.transform = `translateY(-${stopPosition}px)`;
                    
                    // Возвращаем рычаг в исходное положение
                    leverRef.current.classList.remove(styles.leverPulled);

                    setIsSpinning(false);
                    // Принудительно обновляем ленту
                    getRouletteHistory().then(res => setHistory(res.data));
                }, 4000); // 4 секунды на основное вращение

            } catch (error) {
                showAlert(error.response?.data?.detail || 'Ошибка прокрутки', 'error');
                leverRef.current.classList.remove(styles.leverPulled);
                setIsSpinning(false);
            }
        }, 100);
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

            {/* --- НОВАЯ СТРУКТУРА СЛОТ-МАШИНЫ --- */}
            <div className={styles.slotMachine}>
                <div className={styles.reelsContainer}>
                    {[reel1Ref, reel2Ref, reel3Ref].map((ref, i) => (
                        <div key={i} className={styles.reel}>
                            <div className={styles.reelTrack} ref={ref}>
                                {/* Дублируем символы для бесконечной прокрутки */}
                                {[...reelSymbols, ...reelSymbols].map((symbol, index) => (
                                    <div key={index} className={styles.symbol}>
                                        <img src={symbol} alt="symbol" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                <div ref={leverRef} className={styles.lever} onClick={handleSpin}>
                    <div className={styles.leverStick}></div>
                    <div className={styles.leverBall}></div>
                </div>
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
