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
      
      <div className={styles.content}>
        <div className={styles.owner}>
          <span>ВЛАДЕЛЕЦ КАРТЫ</span>
          <strong>{user.first_name} {user.last_name}</strong>
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
