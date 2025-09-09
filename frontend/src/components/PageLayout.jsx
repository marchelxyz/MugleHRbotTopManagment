// frontend/src/components/PageLayout.jsx

import React from 'react';
import styles from './PageLayout.module.css';

function PageLayout({ title, children }) {
  return (
    <div className={styles.pageContainer}>
      
      {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
      {/* Теперь в шапке только один элемент - заголовок. 
          Логотип и узоры теперь являются частью фона в CSS.
      */}
      <div className={styles.header}>
          <h1 className={styles.headerTitle}>{title}</h1>
      </div>
      {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}

      <div className={styles.contentArea}>
        {children}
      </div>
    </div>
  );
}

export default PageLayout;
