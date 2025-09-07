// frontend/src/components/PageLayout.jsx

import React from 'react';

// Мы БОЛЬШЕ НЕ ИМПОРТИРУЕМ PageLayout.module.css, так как он нам не нужен
// import styles from './PageLayout.module.css';

/**
 * Этот компонент теперь является простой "прослойкой" (wrapper).
 * Весь макет страницы (отступы, скроллинг) теперь 
 * обрабатывается в App.jsx и App.css (класс .page-content-wrapper).
 * Мы просто возвращаем дочерние элементы "как есть", НЕ добавляя старую шапку.
 */
function PageLayout({ children }) {
  return (
    <>
      {children}
    </>
  );
}

export default PageLayout;
