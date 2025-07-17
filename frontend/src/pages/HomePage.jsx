import React, { useState, useEffect } from 'react';
import { getFeed, getLastMonthLeaderboard } from '../api'; // Убедитесь, что путь '../api' правильный

function HomePage({ user, onNavigate }) {
  const [feed, setFeed] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const feedResponse = await getFeed();
        setFeed(feedResponse.data);
        // Для главной страницы нам пока не нужен рейтинг, мы его вынесем на отдельную страницу
      } catch (error) {
        console.error("Failed to fetch data for home page", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1>{user.first_name}, добро пожаловать!</h1>
        <p style={{ fontSize: '24px', margin: '10px 0' }}>Ваш баланс: <strong>{user.balance}</strong> баллов</p>
      </div>
      
      <button 
        onClick={() => onNavigate('transfer')} 
        style={{ width: '100%', padding: '12px', fontSize: '16px', marginBottom: '30px' }}
      >
        Передать баллы
      </button>

      {/* БЛОК ЛЕНТЫ */}
      <div>
        <h3>💬 Последняя активность</h3>
        {isLoading ? <p>Загрузка ленты...</p> : (
          feed.length > 0 ? (
            feed.map((item, index) => (
              <div key={index} style={{ border: '1px solid #eee', padding: '10px', borderRadius: '8px', marginBottom: '10px' }}>
                <p><strong>{item.sender_name}</strong> &rarr; <strong>{item.receiver_name}</strong>: {item.amount} баллов</p>
                <p style={{ fontStyle: 'italic', color: '#555' }}>"{item.message}"</p>
              </div>
            ))
          ) : <p>Пока не было переводов.</p>
        )}
      </div>
    </div>
  );
}

export default HomePage;
