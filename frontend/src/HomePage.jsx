import React from 'react';

function HomePage({ user, onNavigate }) {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Главный экран</h1>
      <p>Привет, {user.first_name}!</p>
      <p>Ваша должность: {user.position}</p>
      <p>Ваш баланс: {user.balance} баллов</p>
      
      <button 
        onClick={() => onNavigate('transfer')} 
        style={{ width: '100%', padding: '12px', marginTop: '20px', fontSize: '16px' }}
      >
        Передать баллы
      </button>

      {/* Здесь будет лента, лидеры */}
    </div>
  );
}

export default HomePage;
