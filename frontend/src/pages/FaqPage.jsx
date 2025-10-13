// frontend/src/pages/FaqPage.jsx

import React from 'react';
import PageLayout from '../components/PageLayout'; // <-- 1. Импортируем PageLayout
import styles from './FaqPage.module.css';

function FaqPage({ onBack }) {
  return (
    // 2. Оборачиваем все в PageLayout с нужным заголовком
    <PageLayout title="Часто задаваемые вопросы">
      
      {/* 3. Кнопка "Назад" теперь опциональна и стилизована */}
      {onBack && (
        <button onClick={onBack} className={styles.backButton}>
          &larr; Назад к настройкам
        </button>
      )}

      {/* 4. Оборачиваем вопросы в контейнер для стилизации */}
      <div className={styles.faqContainer}>
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

    </PageLayout>
  );
}

export default FaqPage;
