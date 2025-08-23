// frontend/src/components/PageLayout.jsx

import React from 'react';
import styles from './PageLayout.module.css';

// Этот компонент принимает заголовок страницы и ее содержимое (children)
function PageLayout({ title, children }) {
  return (
    <div className={styles.pageContainer}>
      <div className={styles.header}>
        <h1 className={styles.headerTitle}>{title}</h1>
      </div>
      <div className={styles.contentArea}>
        {children}
      </div>
    </div>
  );
}

export default PageLayout;
