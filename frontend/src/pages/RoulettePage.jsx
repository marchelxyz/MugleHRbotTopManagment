// frontend/src/pages/RoulettePage.jsx

import React, { useState, useEffect, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import { spinRoulette, assembleTickets, getRouletteHistory } from '../api';
import styles from './RoulettePage.module.css';
import { FaInfoCircle } from 'react-icons/fa';

const PRIZES = [17, 5, 12, 1, 30, 8, 19, 3, 23, 28, 14, 9, 21, 4, 7, 20, 25, 10, 2, 29, 11, 18, 13, 6, 26, 27, 24, 15, 22, 16];

function RoulettePage({ user, onUpdateUser }) {
  const [localUser, setLocalUser] = useState(user);
  const [history, setHistory] = useState([]);
  const [isSpinning, setIsSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState(null);
  const [infoVisible, setInfoVisible] = useState(false);
  const rouletteTrackRef = useRef(null);

  // --- НАЧАЛО НОВОЙ ЛОГИКИ: "ЖИВАЯ" ЛЕНТА ---
  useEffect(() => {
    // 1. Функция для загрузки свежей истории
    const fetchHistory = async () => {
      try {
        const res = await getRouletteHistory();
        setHistory(res.data);
      } catch (error) {
        console.error("Не удалось обновить историю рулетки:", error);
      }
    };

    // 2. Сразу загружаем историю при открытии страницы
    fetchHistory();

    // 3. Устанавливаем интервал: каждые 5 секунд будем запрашивать обновления
    const intervalId = setInterval(fetchHistory, 5000); // 5000 миллисекунд = 5 секунд

    // 4. Очищаем интервал, когда пользователь уходит со страницы.
    // Это ОБЯЗАТЕЛЬНО, чтобы избежать утечек памяти.
    return () => clearInterval(intervalId);
  }, []); // Пустой массив зависимостей означает, что этот эффект запустится 1 раз

  // --- КОНЕЦ НОВОЙ ЛОГИКИ ---

  const handleAssemble = async () => {
    if (localUser.ticket_parts < 2) return;
    try {
      const response = await assembleTickets();
      setLocalUser(response.data);
      onUpdateUser(response.data);
    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка сборки');
    }
  };

  const handleSpin = async () => {
    if (localUser.tickets < 1 || isSpinning) return;
    setIsSpinning(true);
    setSpinResult(null);
    
    const track = rouletteTrackRef.current;
    track.style.transition = 'none';
    track.style.transform = 'translateX(0)';

    try {
      const response = await spinRoulette();
      const { prize_won, new_balance, new_tickets } = response.data;
      
      const updatedUser = { ...localUser, balance: new_balance, tickets: new_tickets };
      setLocalUser(updatedUser);
      onUpdateUser(updatedUser);

      setTimeout(() => {
        const prizeItemWidth = 80;
        const prizeArrayForAnimation = [...PRIZES, ...PRIZES, ...PRIZES];
        let targetIndex = -1;
        for (let i = PRIZES.length; i < PRIZES.length * 2; i++) {
            if (prizeArrayForAnimation[i] === prize_won) {
                targetIndex = i;
                break;
            }
        }
        if (targetIndex === -1) {
            targetIndex = prizeArrayForAnimation.indexOf(prize_won);
        }

        const containerWidth = track.parentElement.offsetWidth;
        const stopPosition = (targetIndex * prizeItemWidth) - (containerWidth / 2) + (prizeItemWidth / 2);
        const randomOffset = Math.random() * 40 - 20;
        const finalPosition = stopPosition + randomOffset;

        track.style.transition = 'transform 4s cubic-bezier(.15,.56,.33,1.03)';
        track.style.transform = `translateX(-${finalPosition}px)`;
        
        setTimeout(() => {
          setSpinResult(prize_won);
          setIsSpinning(false);
          // После своего спина можно принудительно обновить ленту, не дожидаясь интервала
          getRouletteHistory().then(res => setHistory(res.data));
        }, 4100);
      }, 100);

    } catch (error) {
      alert(error.response?.data?.detail || 'Ошибка прокрутки');
      setIsSpinning(false);
    }
  };

  return (
    <PageLayout title="Рулетка">
      <div className={styles.infoIcon} onClick={() => setInfoVisible(!infoVisible)}>
        <FaInfoCircle />
      </div>

      {infoVisible && (
        <div className={styles.infoModal}>
          <p>Отправляйте "спасибки" коллегам, чтобы получать части билетов (1 перевод = 1 часть).</p>
          <p>Соберите 2 части, чтобы получить 1 билет для прокрутки рулетки.</p>
          <p>Части билетов сгорают раз в 3 месяца, целые билеты - раз в 4 месяца.</p>
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

      <div className={styles.rouletteContainer}>
        <div className={styles.pointer}></div>
        <div className={styles.rouletteTrack} ref={rouletteTrackRef}>
          {[...PRIZES, ...PRIZES, ...PRIZES].map((prize, index) => (
            <div key={index} className={styles.prizeItem}>{prize}</div>
          ))}
        </div>
      </div>

      {spinResult && <div className={styles.winMessage}>Вы выиграли {spinResult} спасибок! 🎉</div>}

      <button onClick={handleSpin} disabled={localUser.tickets < 1 || isSpinning} className={styles.spinButton}>
        {isSpinning ? 'Крутится...' : `Крутить (1 билет)`}
      </button>

      <div className={styles.history}>
        <h3>Последние победители</h3>
        {history.length > 0 ? history.map(win => (
          <div key={win.id} className={styles.historyItem}>
            <span>{win.user.first_name} {win.user.last_name}</span>
            <strong>выиграл(а) {win.amount} спасибок</strong>
          </div>
        )) : <p>Пока никто не выигрывал.</p>}
      </div>
    </PageLayout>
  );
}

export default RoulettePage;
