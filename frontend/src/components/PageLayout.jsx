// frontend/src/components/PageLayout.jsx

import React from 'react';
import styles from './PageLayout.module.css';

function PageLayout({ title, children }) {
  return (
    <div className={styles.pageContainer}>
      
      <div className={styles.header}>
        <div className={styles.headerContent}>
          
          {/* --- НАЧАЛО ИЗМЕНЕНИЯ --- */}
          <img 
            // Было: src="https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp"
            // Стало:
            src="https://i.postimg.cc/YqcmJB37/6.webp" 
            alt="Спасибо" 
            className={styles.headerLogo} 
          />
          {/* --- КОНЕЦ ИЗМЕНЕНИЯ --- */}

          <h1 className={styles.headerTitle}>{title}</h1>
        </div>
      </div>

      <div className={styles.contentArea}>
        {children}
      </div>
    </div>
  );
}

export default PageLayout;
