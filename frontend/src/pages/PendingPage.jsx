// frontend/src/pages/PendingPage.jsx
import React from 'react';
import styles from './StatusPages.module.css';

function PendingPage() {
  return (
    <div className={styles.statusPage}>
      <div className={styles.icon}>⏳</div>
      <h1>Заявка на рассмотрении</h1>
      <p>Ваша учетная запись находится на подтверждении у администратора. Мы сообщим вам о решении в личном чате.</p>
    </div>
  );
}

export default PendingPage;
