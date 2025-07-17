import React, { useState, useEffect } from 'react';
import { getLastMonthLeaderboard } from '../api'; // Убедитесь, что путь '../api' правильный

function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await getLastMonthLeaderboard();
        setLeaderboard(response.data);
      } catch (error) {
        console.error("Failed to fetch leaderboard", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <h1>🏆 Рейтинг</h1>
      <h3>Лидеры прошлого месяца по полученным баллам</h3>
      
      {isLoading ? <p>Загрузка рейтинга...</p> : (
        leaderboard.length > 0 ? (
          <ol style={{ paddingLeft: '20px', fontSize: '18px' }}>
            {leaderboard.map((item, index) => (
              <li key={index} style={{ marginBottom: '15px' }}>
                <strong>{item.user.first_name}</strong> ({item.user.position})
                <div style={{ color: '#007bff' }}>{item.total_points} баллов</div>
              </li>
            ))}
          </ol>
        ) : <p>В прошлом месяце не было активности.</p>
      )}
    </div>
  );
}

export default LeaderboardPage;
