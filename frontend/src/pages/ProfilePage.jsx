import React from 'react';

function ProfilePage({ user }) {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Профиль</h1>
      <p>Имя: {user.first_name}</p>
      <p>Должность: {user.position}</p>
      <p>Баланс: {user.balance} баллов</p>
    </div>
  );
}

export default ProfilePage;
