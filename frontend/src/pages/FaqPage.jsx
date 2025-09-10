// frontend/src/pages/FaqPage.jsx

import React from 'react';
import styles from './FaqPage.module.css';

function FaqPage({ onBack }) {
  return (
    <div className={styles.page}>
      <button onClick={onBack} className={styles.backButton}>&larr; Назад к настройкам</button>
      <h1>Часто задаваемые вопросы</h1>

      <div className={styles.faqItem}>
        <h4>Как я могу получить баллы "Спасибо"?</h4>
        <p>Вы можете получить баллы от любого коллеги в качестве благодарности за помощь. Также администраторы могут проводить массовые начисления.</p>
      </div>

      <div className={styles.faqItem}>
        <h4>На что я могу потратить баллы?</h4>
        <p>Баллы можно потратить в разделе "Магазин" на доступные там товары и услуги.</p>
      </div>

      <div className={styles.faqItem}>
        <h4>Мои баллы сгорают?</h4>
        <p>Политика сгорания баллов определяется администрацией. На данный момент баллы не сгорают.</p>
      </div>
    </div>
  );
}

export default FaqPage;
