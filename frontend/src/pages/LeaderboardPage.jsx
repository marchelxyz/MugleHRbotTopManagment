// frontend/src/pages/LeaderboardPage.jsx
import React, { useState, useEffect } from 'react';
import { getLastMonthLeaderboard } from '../api';
import styles from './LeaderboardPage.module.css'; // 1. Импортируем стили
import PageLayout from '../components/PageLayout';
import { getCachedData } from '../storage';

function LeaderboardPage() {
  // --- 2. ИЗМЕНЯЕМ ИНИЦИАЛИЗАЦИЮ СОСТОЯНИЯ ---
  const [leaderboard, setLeaderboard] = useState(() => getCachedData('leaderboard'));
  const [isLoading, setIsLoading] = useState(!leaderboard);

  useEffect(() => {
    // Если данные не были в кэше, загружаем их
    if (!leaderboard) {
      const fetchLeaderboard = async () => {
        try {
          const response = await getLastMonthLeaderboard();
          setLeaderboard(response.data);
        } catch (error) { console.error("Failed to fetch leaderboard", error); } 
        finally { setIsLoading(false); }
      };
      fetchLeaderboard();
    }
  }, [leaderboard]);
  
return (
  <PageLayout title="Лидерборд">
      <h3 className={styles.subtitle}>Лидеры прошлого месяца по полученным баллам</h3>
      
      {isLoading ? <p>Загрузка рейтинга...</p> : (
        leaderboard.length > 0 ? (
          <ol className={styles.list}>
            {leaderboard.map((item) => (
              <li key={item.user_id} className={styles.listItem}>
                <strong>{item.user.last_name}</strong>
                <span className={styles.position}>({item.user.position})</span>
                <div className={styles.points}>{item.total_received} баллов</div>
              </li>
            ))}
          </ol>
        ) : <p>В прошлом месяце не было активности.</p>
      )}
    </PageLayout>
  );
}

export default LeaderboardPage;
