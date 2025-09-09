// frontend/src/pages/PendingPage.jsx

import React from 'react';
import styles from './StatusPages.module.css';
import DinoGame from '../components/DinoGame';

function PendingPage() {
  return (
    // Оборачиваем все содержимое в единый div, чтобы стили работали корректно
    // Исключаем лишний Fragment, так как PageLayout не используется здесь
    <div className={styles.pendingPageContainer}> {/* НОВЫЙ КОНТЕЙНЕР */}
      <div className={styles.statusPage}>
        <div className={styles.icon}>⏳</div>
        <h1>Заявка на рассмотрении</h1>
        <p>Ваша учетная запись находится на подтверждении у администратора. Мы сообщим вам о решении в личном чате.</p>
        <p className={styles.subtleHint}>А пока можно поиграть:</p>
      </div>

      {/* --- ИСПРАВЛЕНИЕ: Обёртка для игры в виде карточки --- */}
      <div className={styles.gameCard}> {/* НОВЫЙ КЛАСС */}
        <DinoGame />
      </div>
    </div>
  );
}

export default PendingPage;
