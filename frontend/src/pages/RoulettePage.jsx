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

const reelSymbols = [thankYouIcon, ticketIcon, jackpotIcon, thankYouIcon, ticketIcon];

function RoulettePage({ user, onUpdateUser }) {
    const { showAlert } = useModalAlert();
    const [localUser, setLocalUser] = useState(user);
    const [history, setHistory] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [infoVisible, setInfoVisible] = useState(false);
    const [winAmount, setWinAmount] = useState(null);

    const reel1Ref = useRef(null);
    const reel2Ref = useRef(null);
    const reel3Ref = useRef(null);

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

        const reels = [reel1Ref.current, reel2Ref.current, reel3Ref.current];
        reels.forEach(reel => {
            reel.style.transition = 'none';
            reel.style.transform = `translateY(0)`;
        });

        setTimeout(async () => {
            reels.forEach(reel => {
                reel.style.transition = 'transform 4s cubic-bezier(0.25, 1, 0.5, 1)';
                const randomOffset = Math.floor(Math.random() * reelSymbols.length);
                const totalHeight = reel.scrollHeight;
                const finalPosition = totalHeight - ((totalHeight / reelSymbols.length) * (randomOffset + 1));
                reel.style.transform = `translateY(-${finalPosition}px)`;
            });

            try {
                const response = await spinRoulette();
                const { prize_won, new_balance, new_tickets } = response.data;
                const updatedUser = { ...localUser, balance: new_balance, tickets: new_tickets };
                
                setTimeout(() => {
                    setLocalUser(updatedUser);
                    onUpdateUser(updatedUser);
                    setWinAmount(prize_won);
                    
                    const prizeIcon = PRIZES[prize_won];
                    const prizeIndex = reelSymbols.lastIndexOf(prizeIcon);
                    
                    const iconHeight = reel2Ref.current.scrollHeight / reelSymbols.length;
                    const stopPosition = prizeIndex * iconHeight;

                    reel2Ref.current.style.transition = 'transform 1s ease-out';
                    reel2Ref.current.style.transform = `translateY(-${stopPosition}px)`;
                    
                    setIsSpinning(false);
                    getRouletteHistory().then(res => setHistory(res.data));
                }, 4000);

            } catch (error) {
                showAlert(error.response?.data?.detail || 'Ошибка прокрутки', 'error');
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

            {/* --- ОБНОВЛЕННАЯ СТРУКТУРА СЛОТ-МАШИНЫ --- */}
            <div className={styles.slotMachineWrapper}>
                <div className={styles.slotMachine}>
                    <div className={styles.slotGloss}></div>
                    <div className={styles.slotScreen}>
                        <div className={styles.reelsContainer}>
                            {[reel1Ref, reel2Ref, reel3Ref].map((ref, i) => (
                                <div key={i} className={styles.reel}>
                                    <div className={styles.reelTrack} ref={ref}>
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
