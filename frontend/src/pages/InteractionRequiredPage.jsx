// frontend/src/pages/InteractionRequiredPage.jsx

import React from 'react';
import styles from './StatusPages.module.css';

function InteractionRequiredPage() {
  const tg = window.Telegram.WebApp;
  const botUsername = tg.initDataUnsafe?.start_param?.split('_')[0] || 'your_bot'; // Можно настроить имя бота
  
  return (
    <div className={styles.statusPage}>
      <div className={styles.icon}>🤖</div>
      <h1>Требуется взаимодействие с ботом</h1>
      <p>
        Для использования приложения необходимо отправить сообщение боту или нажать кнопку "Старт" в чате с ботом.
      </p>
      <p style={{ marginTop: '20px', fontSize: '14px', color: '#6E7A85' }}>
        После этого приложение будет доступно для использования.
      </p>
    </div>
  );
}

export default InteractionRequiredPage;
