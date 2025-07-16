// frontend/src/HomePage.jsx
import React from 'react';

function HomePage({ user }) {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Главный экран</h1>
      <p>Привет, {user.first_name}!</p>
      <p>Ваша должность: {user.position}</p>
      <p>Ваш баланс: {user.balance} баллов</p>
      {/* Здесь будет лента, лидеры и кнопка "Передать баллы" */}
    </div>
  );
}

export default HomePage;
