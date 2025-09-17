// frontend/src/pages/LeaderboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getLeaderboard, getMyRank } from '../api';
import styles from './LeaderboardPage.module.css';
import PageLayout from '../components/PageLayout';
import { FaMedal } from 'react-icons/fa'; // Иконка для пьедестала

// Определяем наши вкладки
const TABS = [
  { id: 'current_month_received', label: 'Этот месяц', params: { period: 'current_month', type: 'received' } },
  { id: 'last_month_received', label: 'Прошлый месяц', params: { period: 'last_month', type: 'received' } },
  { id: 'generosity', label: 'Щедрость', params: { period: 'current_month', type: 'sent' } },
  { id: 'all_time_received', label: 'За всё время', params: { period: 'all_time', type: 'received' } },
];

function LeaderboardPage({ user }) {
  const [activeTab, setActiveTab] = useState(TABS[0].id);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const tabConfig = TABS.find(t => t.id === activeTab);
      if (!tabConfig) return;

      const [leaderboardRes, myRankRes] = await Promise.all([
        getLeaderboard(tabConfig.params),
        getMyRank(tabConfig.params)
      ]);
      
      setLeaderboard(leaderboardRes.data);
      setMyRank(myRankRes.data);

    } catch (error) {
      console.error("Failed to fetch leaderboard data", error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const top3 = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  return (
    <PageLayout title="Рейтинг">
      <div className={styles.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={activeTab === tab.id ? styles.tabActive : styles.tab}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? <p>Загрузка рейтинга...</p> : (
        <>
          {myRank && myRank.rank !== null && (
            <div className={styles.myRankCard}>
              <p>Вы на <strong>{myRank.rank}-м</strong> месте</p>
              <p className={styles.details}>
                {myRank.total_received} баллов из {myRank.total_participants} участников
              </p>
            </div>
          )}

          {top3.length > 0 && (
            <div className={styles.podium}>
              {/* Второе место */}
              {top3[1] && (
                <div className={`${styles.podiumItem} ${styles.place2}`}>
                  <FaMedal className={styles.podiumIcon} color="#C0C0C0" />
                  <img src={top3[1].user.telegram_photo_url || 'placeholder.png'} alt={top3[1].user.first_name} className={styles.podiumAvatar} />
                  <div className={styles.podiumName}>{top3[1].user.first_name} {top3[1].user.last_name}</div>
                  <div className={styles.podiumPoints}>{top3[1].total_received}</div>
                </div>
              )}
              {/* Первое место */}
              {top3[0] && (
                <div className={`${styles.podiumItem} ${styles.place1}`}>
                  <FaMedal className={styles.podiumIcon} color="#FFD700" />
                  <img src={top3[0].user.telegram_photo_url || 'placeholder.png'} alt={top3[0].user.first_name} className={styles.podiumAvatar} />
                  <div className={styles.podiumName}>{top3[0].user.first_name} {top3[0].user.last_name}</div>
                  <div className={styles.podiumPoints}>{top3[0].total_received}</div>
                </div>
              )}
              {/* Третье место */}
              {top3[2] && (
                <div className={`${styles.podiumItem} ${styles.place3}`}>
                  <FaMedal className={styles.podiumIcon} color="#CD7F32" />
                  <img src={top3[2].user.telegram_photo_url || 'placeholder.png'} alt={top3[2].user.first_name} className={styles.podiumAvatar} />
                  <div className={styles.podiumName}>{top3[2].user.first_name} {top3[2].user.last_name}</div>
                  <div className={styles.podiumPoints}>{top3[2].total_received}</div>
                </div>
              )}
            </div>
          )}

          {others.length > 0 && (
            <ol start="4" className={styles.list}>
              {others.map((item, index) => (
                <li key={item.user.id} className={styles.listItem}>
                  <span className={styles.rank}>{index + 4}</span>
                  <div className={styles.userInfo}>
                    <span className={styles.userName}>{item.user.first_name} {item.user.last_name}</span>
                    <span className={styles.userPosition}>{item.user.position}</span>
                  </div>
                  <span className={styles.points}>{item.total_received}</span>
                </li>
              ))}
            </ol>
          )}

          {leaderboard.length === 0 && <p>В этом рейтинге пока нет данных.</p>}
        </>
      )}
    </PageLayout>
  );
}

export default LeaderboardPage;
