// frontend/src/pages/PendingPage.jsx

import React from 'react';
import styles from './StatusPages.module.css';
// --- 1. ИМПОРТИРУЕМ НАШУ ИГРУ ---
import DinoGame from '../components/DinoGame';

function PendingPage() {
  return (
    // Используем React Fragment, чтобы не добавлять лишних div
    <>
      <div className={styles.statusPage}>
        <div className={styles.icon}>⏳</div>
        <h1>Заявка на рассмотрении</h1>
        <p>Ваша учетная запись находится на подтверждении у администратора. Мы сообщим вам о решении в личном чате.</p>
        <p className={styles.subtleHint}>А пока можно поиграть:</p>
      </div>

      {/* --- 2. ДОБАВЛЯЕМ КОМПОНЕНТ С ИГРОЙ --- */}
      <DinoGame />
    </>
  );
}

export default PendingPage;
