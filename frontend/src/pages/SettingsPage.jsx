// frontend/src/pages/SettingsPage.jsx

import React from 'react';
import styles from './SettingsPage.module.css';
import { FaQuestionCircle, FaHeadset, FaFileContract, FaBookOpen, FaSignOutAlt } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import { isTelegramMode, clearAuth } from '../utils/auth';

function SettingsPage({ onBack, onNavigate, onRepeatOnboarding }) {

  // Ссылка на ваш аккаунт поддержки в Telegram
  const supportUrl = 'https://t.me/fix2Form'; // <-- НЕ ЗАБУДЬТЕ ЗАМЕНИТЬ НА ВАШ АККАУНТ
  
  const telegramMode = isTelegramMode();
  
  const handleLogout = () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      clearAuth();
      window.location.reload();
    }
  };

  return (
    // 1. Используем PageLayout с названием "Настройки", которое отобразится в шапке
    <PageLayout title="Настройки">
      
      {/* 2. Кнопка "Назад" теперь стилизована и расположена вверху контента */}
      <button onClick={onBack} className={styles.backButton}>
        &larr; Назад в профиль
      </button>

      {/* 3. Основной список опций */}
      <div className={styles.settingsList}>

        {/* 3. Добавляем новую кнопку */}
        <button onClick={onRepeatOnboarding} className={styles.settingsItem}>
          <FaBookOpen className={styles.icon} />
          <span>Пройти обучение повторно</span>
        </button>
        
        {/* Кнопка FAQ */}
        <button onClick={() => onNavigate('faq')} className={styles.settingsItem}>
          <FaQuestionCircle className={styles.icon} />
          <span>Часто задаваемые вопросы (FAQ)</span>
        </button>

        {/* Ссылка на поддержку */}
        <a href={supportUrl} target="_blank" rel="noopener noreferrer" className={styles.settingsItem}>
          <FaHeadset className={styles.icon} />
          <span>Поддержка</span>
        </a>

        {/* Неактивная кнопка */}
        <div className={styles.settingsItemDisabled}>
          <FaFileContract className={styles.icon} />
          <span>Юридическая документация</span>
        </div>

        {/* Кнопка выхода (только для браузерного режима) */}
        {!telegramMode && (
          <button onClick={handleLogout} className={`${styles.settingsItem} ${styles.logoutButton}`}>
            <FaSignOutAlt className={styles.icon} />
            <span>Выйти</span>
          </button>
        )}

      </div>
    </PageLayout>
  );
}

export default SettingsPage;
