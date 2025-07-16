// frontend/src/HomePage.jsx (Диагностическая версия)
import React from 'react';

function HomePage({ user }) {
  return (
    <div style={{ padding: '20px', wordWrap: 'break-word' }}>
      <h1>Главный экран</h1>
      <p>Привет, {user.first_name}!</p>
      <p>Ваша должность: {user.position}</p>
      <p>Ваш баланс: {user.balance} баллов</p>

      <hr />
      <h2 style={{ marginTop: '20px' }}>Отладочная информация:</h2>
      <pre style={{ whiteSpace: 'pre-wrap', background: '#eee', padding: '10px' }}>
        {JSON.stringify(user, null, 2)}
      </pre>
    </div>
  );
}

export default HomePage;
