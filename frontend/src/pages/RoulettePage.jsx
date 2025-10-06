// frontend/src/pages/RoulettePage.jsx

import React, { useState, useEffect, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import { spinRoulette, assembleTickets, getRouletteHistory } from '../api';
import styles from './RoulettePage.module.css';
import { FaInfoCircle, FaTicketAlt } from 'react-icons/fa';
import { useAuth } from '/src/contexts/AuthContext';
import UserAvatar from '../components/UserAvatar';
import { formatToMsk } from '../utils/dateFormatter';

// --- НОВАЯ ЛОГИКА ГЕНЕРАЦИИ ПРИЗОВ ---
// Функция для создания "ленты" с призами для анимации
const generatePrizeReel = (finalPrize) => {
    const reelLength = 50; // Общая длина ленты
    const prizes = [];
    for (let i = 0; i < reelLength; i++) {
        // Заполняем случайными числами от 1 до 15
        prizes.push(Math.floor(Math.random() * 15) + 1);
    }
    // Вставляем наш реальный выигрыш примерно в конец ленты
    prizes[reelLength - 5] = finalPrize;
    return prizes;
};

function RoulettePage() {
    const { user, fetchUser } = useAuth(); // Используем хук для обновления данных
    const [history, setHistory] = useState([]);
    const [isSpinning, setIsSpinning] = useState(false);
    const [infoVisible, setInfoVisible] = useState(false);
    const [prizeReel, setPrizeReel] = useState([]);
    const rouletteTrackRef = useRef(null);

    // Загружаем историю победителей при первом открытии страницы
    useEffect(() => {
        getRouletteHistory().then(res => setHistory(res.data));
    }, []);

    // Функция сборки билетов
    const handleAssemble = async () => {
        if (user.ticket_parts < 3) return;
        try {
            await assembleTickets();
            await fetchUser(); // Обновляем данные пользователя
        } catch (error) {
            console.error("Failed to assemble tickets", error);
        }
    };

    // Главная функция прокрутки рулетки
    const handleSpin = async () => {
        if (user.tickets < 1 || isSpinning) return;
        
        setIsSpinning(true);
        rouletteTrackRef.current.style.transition = 'none';
        rouletteTrackRef.current.style.transform = `translateX(0px)`;

        try {
            const response = await spinRoulette();
            const { prize_won } = response.data;

            // Генерируем новую ленту с нашим выигрышем
            const newReel = generatePrizeReel(prize_won);
            setPrizeReel(newReel);

            // Даем React время отрисовать новую ленту
            setTimeout(() => {
                const prizeElementWidth = 80; // Ширина одного элемента в ленте
                const stopPosition = (newReel.length - 5) * prizeElementWidth; // Позиция нашего приза
                const randomOffset = (Math.random() - 0.5) * (prizeElementWidth * 0.8);
                const finalPosition = stopPosition - randomOffset;

                rouletteTrackRef.current.style.transition = 'transform 5s cubic-bezier(0.2, 0.8, 0.2, 1)';
                rouletteTrackRef.current.style.transform = `translateX(-${finalPosition}px)`;

                // После завершения анимации обновляем данные
                setTimeout(async () => {
                    await fetchUser();
                    const historyRes = await getRouletteHistory();
                    setHistory(historyRes.data);
                    setIsSpinning(false);
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
                <button onClick={handleAssemble} disabled={user?.ticket_parts < 3}>Собрать</button>
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

            <button onClick={handleSpin} disabled={user?.tickets < 1 || isSpinning} className={styles.spinButton}>
                {isSpinning ? 'Крутится...' : `Крутить (1 билет)`}
            </button>

            <div className={styles.historySection}>
                <h3>Лента победителей</h3>
                <div className={styles.historyList}>
                    {history.map(win => (
                        <div key={win.id} className={styles.historyItem}>
                             <UserAvatar user={win.user} size="small" />
                             <div className={styles.historyInfo}>
                                <p><strong>{win.user.first_name} {win.user.last_name}</strong></p>
                                <p>выиграл(а) <strong>{win.amount} спасибок</strong></p>
                             </div>
                             <span className={styles.historyTimestamp}>{formatToMsk(win.timestamp)}</span>
                        </div>
                    ))}
                </div>
            </div>
        </PageLayout>
    );
}

export default RoulettePage;
