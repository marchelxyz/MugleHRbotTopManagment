// frontend/src/pages/RoulettePage.jsx

import React, { useState, useRef } from 'react';
import styles from './RoulettePage.module.css';
import { spinRoulette } from '../api'; // Убедитесь, что api.js на месте

const RoulettePage = ({ user, onBack, updateUser }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  // Рефы для каждого барабана
  const reel1 = useRef(null);
  const reel2 = useRef(null);
  const reel3 = useRef(null);

  // Список чисел на каждом барабане. Вы можете сделать его длиннее или изменить значения.
  const reelNumbers = [100, 20, 50, 0, 10, 100, 0, 50, 10, 20];

  const handleSpin = async () => {
    if (isSpinning || user.points_balance < 10) {
      alert(user.points_balance < 10 ? "Недостаточно очков для вращения!" : "Вращение уже идет!");
      return;
    }

    setIsSpinning(true);

    try {
      const result = await spinRoulette(); // Вызов API для получения результата
      updateUser({ ...user, points_balance: result.current_balance });
      
      // Здесь должна быть логика анимации для каждого барабана,
      // чтобы в итоге остановиться на нужных цифрах.
      // Пока что сделаем простую случайную анимацию.
      
      const animateReel = (reelRef, delay) => {
        setTimeout(() => {
          const randomIndex = Math.floor(Math.random() * reelNumbers.length);
          const backgroundPosition = `0 -${randomIndex * 100}px`; // Примерная позиция
          if (reelRef.current) {
             reelRef.current.style.transition = 'background-position 3s ease-out';
             reelRef.current.style.backgroundPosition = backgroundPosition;
          }
        }, delay);
      };

      animateReel(reel1, 0);
      animateReel(reel2, 500);
      animateReel(reel3, 1000);

    } catch (error) {
      console.error('Spin error:', error);
      alert(error.detail || 'Произошла ошибка во время вращения.');
    } finally {
      // Даем анимации завершиться
      setTimeout(() => {
        setIsSpinning(false);
      }, 4000);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <button onClick={onBack} className={styles.backButton}>Назад</button>
      <h2>Рулетка</h2>
      <p>Стоимость вращения: 10 очков. Ваш баланс: {user.points_balance}</p>
      
      {/* НАЧАЛО ИЗМЕНЕНИЙ: Новый корпус, нарисованный с помощью CSS.
        Вместо одного div с background-image у нас теперь структура из нескольких div'ов,
        каждый из которых стилизуется в CSS для создания 3D-эффекта.
      */}
      <div className={styles.slotMachineBody}>
        <div className={styles.windowsContainer}>
          {/* Три окошка для барабанов */}
          <div className={styles.window}>
            <div ref={reel1} className={styles.reel}>
              {reelNumbers.map((num, i) => <div key={i}>{num}</div>)}
            </div>
          </div>
          <div className={styles.window}>
            <div ref={reel2} className={styles.reel}>
              {reelNumbers.map((num, i) => <div key={i}>{num}</div>)}
            </div>
          </div>
          <div className={styles.window}>
            <div ref={reel3} className={styles.reel}>
              {reelNumbers.map((num, i) => <div key={i}>{num}</div>)}
            </div>
          </div>
        </div>
      </div>
      {/* КОНЕЦ ИЗМЕНЕНИЙ */}

      <button onClick={handleSpin} disabled={isSpinning} className={styles.spinButton}>
        {isSpinning ? 'Вращение...' : 'Крутить!'}
      </button>
    </div>
  );
};

export default RoulettePage;
