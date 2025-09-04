// frontend/src/components/BonusCard.jsx
import React from 'react';
import Barcode from 'react-barcode';
import styles from './BonusCard.module.css';

function BonusCard({ user }) {
  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <span className={styles.brand}>mugle rest</span>
        <div className={styles.balance}>
          <span>БАЛАНС</span>
          {/* --- ИСПРАВЛЕНИЕ: Используем баланс карты --- */}
          <strong>{user.card_balance || 0}</strong>
        </div>
      </div>
      <div className={styles.swoosh}>
        <img src="https://i.postimg.cc/d1yYt4wW/art.png" alt="art" />
      </div>
      <div className={styles.content}>
        <div className={styles.owner}>
          <span>ВЛАДЕЛЕЦ КАРТЫ</span>
          <strong>{user.first_name} {user.last_name}</strong>
        </div>
        <div className={styles.barcodeWrapper}>
          {user.card_barcode && (
            <Barcode 
              value={user.card_barcode}
              displayValue={false}
              height={60}
              margin={0}
              background="transparent"
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default BonusCard;
