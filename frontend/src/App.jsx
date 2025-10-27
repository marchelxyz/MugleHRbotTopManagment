// frontend/src/App.jsx

import React, { useEffect } from 'react';
import './App.css';
import { ConfirmationProvider } from './contexts/ConfirmationContext';
import { ModalAlertProvider } from './contexts/ModalAlertContext';
import AppRouter from './components/AppRouter';
import { initializeCache, refreshAllData } from './storage';

function App() {
  useEffect(() => {
    // Инициализация Telegram WebApp
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
      
      // Инициализируем кэш
      initializeCache();
      
      // Обновляем данные
      refreshAllData();
    }
  }, []);

  return (
    <ConfirmationProvider>
      <ModalAlertProvider>
        <AppRouter />
      </ModalAlertProvider>
    </ConfirmationProvider>
  );
}

export default App;
