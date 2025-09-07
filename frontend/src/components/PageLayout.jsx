// frontend/src/components/PageLayout.jsx

import React from 'react';
import './PageLayout.module.css'; // Убедитесь, что этот файл пуст или удален, т.к. стили для PageLayout больше не нужны

// Мы убрали 'title', так как он теперь в App.jsx
function PageLayout({ children }) { 
  return (
    <div className="page-layout"> {/* Этот класс 'page-layout' по сути не нужен, т.к. стили теперь в .page-content-wrapper */}
      {/* Раньше здесь был заголовок, но теперь он перемещен в App.jsx,
        в верхнюю левую плавающую панель.
      */}
      {children}
    </div>
  );
}

export default PageLayout;
