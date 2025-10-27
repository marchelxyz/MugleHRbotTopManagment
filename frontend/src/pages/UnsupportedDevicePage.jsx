// frontend/src/pages/UnsupportedDevicePage.jsx
// (НОВЫЙ ФАЙЛ)

import React from 'react';
// Мы будем использовать те же стили, что и для страниц Pending/Rejected
import styles from './StatusPages.module.css'; 

function UnsupportedDevicePage() {
  return (
    <div className={styles.statusPage}>
      <div className={styles.icon}>🖥️</div>
      <h1>Устройство не поддерживается</h1>
      <p>
        Это приложение оптимизировано для мобильных устройств. 
        Пожалуйста, откройте его на своем телефоне.
      </p>
    </div>
  );
}

export default UnsupportedDevicePage;
