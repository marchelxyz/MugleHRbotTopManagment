// frontend/src/pages/RejectedPage.jsx
import React from 'react';
import styles from './StatusPages.module.css';

function RejectedPage() {
  return (
    <div className={styles.statusPage}>
      <div className={styles.icon}>❌</div>
      <h1>В регистрации отказано</h1>
      <p>К сожалению, ваша заявка была отклонена. Для уточнения деталей свяжитесь с администратором.</p>
    </div>
  );
}

export default RejectedPage;
