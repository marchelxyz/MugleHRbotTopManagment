// frontend/src/pages/BlockedPage.jsx (НОВЫЙ ФАЙЛ)

import React from 'react';
import styles from './StatusPages.module.css'; // Используем общие стили

function BlockedPage() {
  return (
    <div className={styles.statusPage}>
      <div className={styles.icon}>🚫</div>
      <h1>Доступ заблокирован</h1>
      <p>Ваша учетная запись была заблокирована администратором. Для уточнения деталей свяжитесь с поддержкой.</p>
    </div>
  );
}

export default BlockedPage;
