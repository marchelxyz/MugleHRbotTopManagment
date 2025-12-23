// frontend/src/main.jsx
console.log('--- Application bootstrap sequence initiated ---'); 

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// 1. Импортируем наши ПРАВИЛЬНЫЕ Provider'ы
import { ModalAlertProvider } from './contexts/ModalAlertContext.jsx';
import { ConfirmationProvider } from './contexts/ConfirmationContext.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';

// --- НАЧАЛО ИЗМЕНЕНИЙ: Локализация календаря ---
import { registerLocale } from 'react-datepicker';
import { ru } from 'date-fns/locale/ru';

// Регистрируем русскую локаль под кодом 'ru'
registerLocale('ru', ru);
// --- КОНЕЦ ИЗМЕНЕНИЙ ---

// Обработка ошибок рендеринга
try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        {/* 2. Оборачиваем App в правильные Provider'ы */}
        {/* Теперь они действительно будут работать для всего приложения */}
        <ConfirmationProvider>
          <ModalAlertProvider>
            <App />
          </ModalAlertProvider>
        </ConfirmationProvider>
      </ErrorBoundary>
    </React.StrictMode>,
  );
} catch (error) {
  console.error('Ошибка при рендеринге приложения:', error);
  // Показываем сообщение об ошибке пользователю
  document.body.innerHTML = `
    <div style="display: flex; justify-content: center; align-items: center; height: 100vh; flex-direction: column; font-family: Arial, sans-serif;">
      <h2>Ошибка загрузки приложения</h2>
      <p>Пожалуйста, обновите страницу</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">
        Обновить
      </button>
    </div>
  `;
}
