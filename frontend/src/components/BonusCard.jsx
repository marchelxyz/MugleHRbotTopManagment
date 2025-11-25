// frontend/src/components/BonusCard.jsx
import React from 'react';
import Barcode from 'react-barcode';
import styles from './BonusCard.module.css';

function BonusCard({ user }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        {/* <span className={styles.brand}>mugle rest</span> */} 
        <div className={styles.balance}>
          <span>БАЛАНС</span>
          <strong>{user.card_balance || 0}</strong>
        </div>
      </div>
      {/* --- ИЗМЕНЕНИЕ: Заменяем картинку на div --- */}
      <div className={styles.swoosh}></div>

      {/* --- НАЧАЛО ДОБАВЛЕНИЙ: Изображение в центре карты --- */}
      <div className={styles.centerImageContainer}>
        {/* Замените этот URL на ваш фактический URL изображения */}
        <img 
          src="https://i.postimg.cc/L8rxGLYz/Chat-GPT-Image-5-2025-00-30-17.webp" 
          alt="Card Center" 
          className={styles.centerImage} 
        />
      </div>
      
      <div className={styles.content}>
        <div className={styles.owner}>
          <span>ВЛАДЕЛЕЦ КАРТЫ</span>
          <strong>{user.username ? `${user.first_name} ${user.last_name}` : user.first_name}</strong>
        </div>
        <div className={styles.barcodeWrapper}>
          {user.card_barcode && (
            <Barcode 
              value={user.card_barcode}
              // --- ИСПРАВЛЕНИЕ: Включаем отображение цифр ---
              displayValue={true} 
              height={60}
              margin={0}
              background="transparent"
              fontSize={16} // Управляем размером шрифта
              lineColor="#000" // Цвет штрих-кода
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default BonusCard;
