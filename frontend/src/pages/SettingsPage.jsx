// frontend/src/pages/SettingsPage.jsx

import React from 'react';
import styles from './SettingsPage.module.css';
import { FaQuestionCircle, FaHeadset, FaFileContract } from 'react-icons/fa';

// onBack - для возврата на страницу профиля
// onNavigate - для перехода на страницу FAQ
function SettingsPage({ onBack, onNavigate }) {

  // Ссылка на ваш аккаунт поддержки в Telegram
  const supportUrl = 'https://t.me/your_support_account'; // <-- ЗАМЕНИТЕ НА ВАШ АККАУНТ

  return (
    <div className={styles.page}>
      <button onClick={onBack} className={styles.backButton}>&larr; Назад в профиль</button>
      <h1>Настройки и помощь</h1>

      <div className={styles.list}>
        <button onClick={() => onNavigate('faq')} className={styles.listItem}>
          <FaQuestionCircle className={styles.icon} />
          <span>Часто задаваемые вопросы (FAQ)</span>
        </button>

        {/* Кнопка поддержки открывает прямую ссылку на аккаунт в Telegram */}
        <a href={supportUrl} target="_blank" rel="noopener noreferrer" className={styles.listItem}>
          <FaHeadset className={styles.icon} />
          <span>Поддержка</span>
        </a>

        {/* Можно добавить в будущем */}
        <div className={styles.listItemDisabled}>
          <FaFileContract className={styles.icon} />
          <span>Юридическая документация</span>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
