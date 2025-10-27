// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 1. Импортируем наши ПРАВИЛЬНЫЕ Provider'ы
import { ModalAlertProvider } from './contexts/ModalAlertContext.jsx';
import { ConfirmationProvider } from './contexts/ConfirmationContext.jsx';

// --- НАЧАЛО ИЗМЕНЕНИЙ: Локализация календаря ---
import { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';

// Регистрируем русскую локаль под кодом 'ru'
registerLocale('ru', ru);
// --- КОНЕЦ ИЗМЕНЕНИЙ ---

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* 2. Оборачиваем App в правильные Provider'ы */}
    {/* Теперь они действительно будут работать для всего приложения */}
    <ConfirmationProvider>
      <ModalAlertProvider>
        <App />
      </ModalAlertProvider>
    </ConfirmationProvider>
  </React.StrictMode>,
);
