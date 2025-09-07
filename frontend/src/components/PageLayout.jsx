// frontend/src/components/PageLayout.jsx

import React from 'react';

// Убедитесь, что строка "import styles..." полностью удалена или закомментирована.

/**
 * Это "пустой" компонент-обертка. Он не должен ничего рисовать.
 * Вся разметка (скролл, отступы) теперь в App.css.
 */
function PageLayout({ children }) {
  return (
    <>
      {children}
    </>
  );
}

export default PageLayout;
