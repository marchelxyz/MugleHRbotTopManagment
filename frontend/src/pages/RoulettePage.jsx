// frontend/src/pages/RoulettePage.jsx

import React, { useState, useEffect, useRef, useMemo } from 'react';
import PageLayout from '../components/PageLayout';
import { spinRoulette, assembleTickets, getRouletteHistory } from '../api';
import styles from './RoulettePage.module.css';
import { FaInfoCircle, FaTicketAlt } from 'react-icons/fa';
import UserAvatar from '../components/UserAvatar';
import { formatToMsk, formatFeedDate } from '../utils/dateFormatter';
import WinModal from '../components/WinModal';

const generatePrizeReel = (finalPrize) => {
    const reelLength = 50;
    const prizes = [];
    for (let i = 0; i < reelLength; i++) {
        prizes.push(Math.floor(Math.random() * 15) + 1);
    }
    prizes[reelLength - 5] = finalPrize;
    return prizes;
};

function RoulettePage({ user, onUpdateUser }) {
    const [history, setHistory] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [infoVisible, setInfoVisible] = useState(false);
    const [prizeReel, setPrizeReel] = useState(() => generatePrizeReel(1));
    const [winPrize, setWinPrize] = useState(null);
    const rouletteTrackRef = useRef(null);

    useEffect(() => {
        getRouletteHistory().then(res => setHistory(res.data));
    }, []);

    const groupedHistory = useMemo(() => {
        if (!history || history.length === 0) return {};
        return history.reduce((acc, item) => {
            const dateKey = formatToMsk(item.timestamp, { year: undefined, month: undefined, day: undefined, hour: undefined, minute: undefined });
            if (!acc[dateKey]) {
                acc[dateKey] = [];
            }
            acc[dateKey].push(item);
            return acc;
        }, {});
    }, [history]);
    
    const handleAssemble = async () => {
        if (!user || user.ticket_parts < 3) return;
        try {
            const response = await assembleTickets();
            onUpdateUser(response.data); // API возвращает обновленный объект user
        } catch (error) {
            console.error("Failed to assemble tickets", error);
            alert(error.response?.data?.detail || "Ошибка сборки билета");
        }
    };

    const handleSpin = async () => {
        if (!user || user.tickets < 1 || isSpinning || winPrize) return;
        
        setIsSpinning(true);
        setWinPrize(null);
        rouletteTrackRef.current.style.transition = 'none';
        rouletteTrackRef.current.style.transform = `translateX(0px)`;

        try {
            const response = await spinRoulette();
            const { prize_won, new_balance, new_tickets } = response.data;

            const newReel = generatePrizeReel(prize_won);
            setPrizeReel(newReel);

            setTimeout(() => {
                const prizeElementWidth = 80;
                const stopPosition = (newReel.length - 5) * prizeElementWidth;
                const randomOffset = (Math.random() - 0.5) * (prizeElementWidth * 0.8);
                const finalPosition = stopPosition - randomOffset;

                rouletteTrackRef.current.style.transition = 'transform 5s cubic-bezier(0.2, 0.8, 0.2, 1)';
                rouletteTrackRef.current.style.transform = `translateX(-${finalPosition}px)`;

                setTimeout(async () => {
                    setIsSpinning(false);
                    setWinPrize(prize_won);
                    
                    // Обновляем баланс и билеты в главном компоненте App.jsx
                    onUpdateUser({ balance: new_balance, tickets: new_tickets });
                    
                    const historyRes = await getRouletteHistory();
                    setHistory(historyRes.data);
                }, 5000);
            }, 100);

        } catch (error) {
            console.error("Failed to spin roulette", error);
            alert(error.response?.data?.detail || "Произошла ошибка");
            setIsSpinning(false);
        }
    };

    return (
        <PageLayout title="Рулетка">
            {/* --- ИЗМЕНЕНИЕ: Добавляем белую подложку-контейнер --- */}
            <div className={styles.rouletteContent}>
                <FaInfoCircle className={styles.infoIcon} onClick={() => setInfoVisible(!infoVisible)} />

                {infoVisible && (
                    <div className={styles.infoModal}>
                        <h3>Как работает рулетка?</h3>
                        <p>• Каждая отправка "спасибо" дает вам 1 часть билета.</p>
                        <p>• Соберите 3 части, чтобы получить 1 билет для рулетки.</p>
                        <p>• Чем больше выигрыш, тем ниже шанс его выпадения.</p>
                    </div>
                )}

                <div className={styles.userBalance}>
                    <div className={styles.balanceBox}>
                        <span>Части билетов</span>
                        <strong>{user?.ticket_parts || 0} / 3</strong>
                    </div>
                    <button onClick={handleAssemble} disabled={!user || user.ticket_parts < 3}>Собрать</button>
                    <div className={styles.balanceBox}>
                        <FaTicketAlt />
                        <strong>{user?.tickets || 0}</strong>
                    </div>
                </div>

                <div className={styles.rouletteContainer}>
                    <div className={styles.pointer}></div>
                    <div className={styles.rouletteTrack} ref={rouletteTrackRef}>
                        {prizeReel.map((prize, index) => (
                            <div key={index} className={styles.prizeItem}>{prize}</div>
                        ))}
                    </div>
                </div>

                <button 
                    onClick={handleSpin} 
                    disabled={!user || user.tickets < 1 || isSpinning || winPrize} 
                    className={styles.spinButton}
                >
                    {isSpinning ? 'Крутится...' : `Крутить (1 билет)`}
                </button>

                <div className={styles.historySection}>
                    <h3>Лента победителей</h3>
                    <div className={styles.historyContainer}>
                        {Object.keys(groupedHistory).length > 0 ? (
                            Object.keys(groupedHistory).map(dateKey => (
                                <React.Fragment key={dateKey}>
                                    <div className={styles.dateHeader}>
                                        <span>{formatFeedDate(groupedHistory[dateKey][0].timestamp)}</span>
                                    </div>
                                    <div className={styles.historyGrid}>
                                        {groupedHistory[dateKey].map(win => (
                                            <div key={win.id} className={styles.historyItem}>
                                                <UserAvatar user={win.user} size="small" />
                                                <div className={styles.historyInfo}>
                                                    <p><strong>{win.user.first_name} {win.user.last_name}</strong></p>
                                                    <p>выиграл(а) <strong>{win.amount} спасибок</strong></p>
                                                </div>
                                                <span className={styles.historyTimestamp}>
                                                    {formatToMsk(win.timestamp, { year: undefined, month: undefined, day: undefined })}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </React.Fragment>
                            ))
                        ) : (
                            <p>В рулетке еще никто не выигрывал.</p>
                        )}
                    </div>
                </div>
            </div>
            {winPrize && <WinModal prize={winPrize} onClose={() => setWinPrize(null)} />}
        </PageLayout>
    );
}

export default RoulettePage;
