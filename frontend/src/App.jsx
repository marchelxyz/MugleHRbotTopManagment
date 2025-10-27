// frontend/src/App.jsx

import React, { useEffect } from 'react';
import './App.css';
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

  return <AppRouter />;
}

export default App;
