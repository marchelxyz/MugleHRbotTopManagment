// frontend/src/components/PageLayout.jsx

import React from 'react';
import styles from './PageLayout.module.css';

function PageLayout({ title, children }) {
  return (
    <div className={styles.pageContainer}>
      
      <div className={styles.header}>
        {/* Этот контейнер будет использовать flexbox для точного выравнивания */}
        <div className={styles.headerContent}>
          {/* 1. Логотип "C" */}
          <img 
            src="https://i.postimg.cc/YqcmJB37/6.webp" 
            alt="Лого" 
            className={styles.headerLogo} 
          />
          {/* 2. Волнистая линия */}
          <img
            src="https://i.postimg.cc/bvMHvzWv/Line-18.webp"
            alt="Разделитель"
            className={styles.headerLine}
          />
          {/* 3. Название раздела */}
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
