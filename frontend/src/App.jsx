// frontend/src/App.jsx (Новая диагностическая версия)
import React, { useState, useEffect } from 'react';

// Получаем объект Telegram Web App
const tg = window.Telegram.WebApp;

function App() {
  // Это состояние для хранения данных из Telegram
  const [telegramData, setTelegramData] = useState(null);

  useEffect(() => {
    // При запуске приложения мы просто сохраняем все данные,
    // которые нам дает Telegram, в состояние.
    tg.ready();
    setTelegramData(tg.initDataUnsafe);
  }, []);

  // Если данные еще не загрузились, показываем "Загрузка..."
  if (!telegramData) {
    return <div>Загрузка данных из Telegram...</div>;
  }

  // Если данные загрузились, показываем их на экране
  return (
    <div style={{ padding: '20px', wordWrap: 'break-word' }}>
      <h1>Отладочная информация из Telegram</h1>
      <p>
        Вот все данные, которые ваше приложение получает от Telegram.
        Проверьте, есть ли здесь объект `user` и какой у него `id`.
      </p>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#eee', padding: '10px', textAlign: 'left' }}>
        {JSON.stringify(telegramData, null, 2)}
      </pre>
    </div>
  );
}

export default App;
