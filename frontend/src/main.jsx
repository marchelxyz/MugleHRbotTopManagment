// frontend/src/main.jsx

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // <-- ДОБАВЛЯЕМ ИМПОРТ ГЛОБАЛЬНЫХ СТИЛЕЙ
import { ModalAlertProvider } from './contexts/ModalAlertContext.jsx'; // 1. Импортируем

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. Оборачиваем App в наш Provider */}
    <ModalAlertProvider>
      <App />
    </ModalAlertProvider>
  </React.StrictMode>,
);
