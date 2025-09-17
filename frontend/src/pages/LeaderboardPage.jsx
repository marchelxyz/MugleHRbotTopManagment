// frontend/src/pages/LeaderboardPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { getLeaderboard, getMyRank, getLeaderboardStatus } from '../api';
import styles from './LeaderboardPage.module.css';
import PageLayout from '../components/PageLayout';
import { FaCrown, FaCalendarDay, FaCalendarAlt, FaGift, FaInfinity } from 'react-icons/fa';

const ALL_TABS = [
  { id: 'current_month_received', label: 'Этот месяц', icon: <FaCalendarDay />, params: { period: 'current_month', type: 'received' } },
  { id: 'last_month_received', label: 'Прошлый месяц', icon: <FaCalendarAlt />, params: { period: 'last_month', type: 'received' } },
  { id: 'generosity', label: 'Щедрость', icon: <FaGift />, params: { period: 'current_month', type: 'sent' } },
  { id: 'all_time_received', label: 'За всё время', icon: <FaInfinity />, params: { period: 'all_time', type: 'received' } },
];

function LeaderboardPage({ user }) {
  const [visibleTabs, setVisibleTabs] = useState(user.is_admin ? ALL_TABS : []);
  const [activeTabId, setActiveTabId] = useState(ALL_TABS[0].id);
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user.is_admin) return;
    const fetchTabStatuses = async () => {
      try {
        const response = await getLeaderboardStatus();
        const activeTabs = ALL_TABS.filter(tab => {
          const status = response.data.find(s => s.id === tab.id);
          return status && status.has_data;
        });
        setVisibleTabs(activeTabs);
        if (activeTabs.length > 0 && !activeTabs.find(t => t.id === activeTabId)) {
          setActiveTabId(activeTabs[0].id);
        } else if (activeTabs.length === 0) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Failed to fetch tab statuses", error);
        setIsLoading(false);
      }
    };
    fetchTabStatuses();
  }, [user.is_admin, activeTabId]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const tabConfig = ALL_TABS.find(t => t.id === activeTabId);
      if (!tabConfig) { setIsLoading(false); return; }
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
  }, [activeTabId]);

  useEffect(() => {
    if (visibleTabs.length > 0) fetchData();
  }, [fetchData, visibleTabs]);

  const top3 = leaderboard.slice(0, 3);
  const others = leaderboard.slice(3);

  return (
    <PageLayout title="Рейтинг">
      {visibleTabs.length > 0 && (
        <div className={styles.tabsContainer}>
          {visibleTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={`${styles.tab} ${activeTabId === tab.id ? styles.tabActive : styles.tabCollapsed}`}
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading ? <p>Загрузка рейтинга...</p> : (
        <>
          {myRank && myRank.rank !== null && (
            <div className={styles.myRankCard}>
              <p>Вы на <strong>{myRank.rank}-м</strong> месте</p>
            </div>
          )}
          {top3.length > 0 && (
            <div className={styles.podium}>
              {top3[1] && (
                <div className={`${styles.podiumItem} ${styles.place2}`}>
                  <FaCrown className={styles.podiumIcon} color="#C0C0C0" />
                  <img src={top3[1].user.telegram_photo_url || 'placeholder.png'} alt={top3[1].user.first_name} className={styles.podiumAvatar} />
                  <div className={styles.podiumName}>{top3[1].user.first_name}</div>
                  <div className={styles.podiumPoints}>{top3[1].total_received}</div>
                </div>
              )}
              {top3[0] && (
                <div className={`${styles.podiumItem} ${styles.place1}`}>
                  <FaCrown className={styles.podiumIcon} color="#FFD700" />
                  <img src={top3[0].user.telegram_photo_url || 'placeholder.png'} alt={top3[0].user.first_name} className={styles.podiumAvatar} />
                  <div className={styles.podiumName}>{top3[0].user.first_name}</div>
                  <div className={styles.podiumPoints}>{top3[0].total_received}</div>
                </div>
              )}
              {top3[2] && (
                <div className={`${styles.podiumItem} ${styles.place3}`}>
                  <FaCrown className={styles.podiumIcon} color="#CD7F32" />
                  <img src={top3[2].user.telegram_photo_url || 'placeholder.png'} alt={top3[2].user.first_name} className={styles.podiumAvatar} />
                  <div className={styles.podiumName}>{top3[2].user.first_name}</div>
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
                  <img src={item.user.telegram_photo_url || 'placeholder.png'} alt={item.user.first_name} className={styles.listItemAvatar} />
                  <div className={styles.userInfo}>
                    {/* --- ИЗМЕНЕНИЕ ЗДЕСЬ --- */}
                    <span className={styles.userName}>{item.user.first_name}</span>
                  </div>
                  <div className={styles.pointsContainer}>
                    <span className={styles.points}>{item.total_received}</span>
                    <img src="https://i.postimg.cc/cLCwXyrL/Frame-2131328056.webp" alt="спасибо" className={styles.pointsLogo} />
                  </div>
                </li>
              ))}
            </ol>
          )}
          
          {leaderboard.length === 0 && visibleTabs.length > 0 && <p>В этом рейтинге пока нет данных.</p>}
          {visibleTabs.length === 0 && !user.is_admin && <p>Рейтинги пока пусты. Скоро здесь появится активность!</p>}
        </>
      )}
    </PageLayout>
  );
}

export default LeaderboardPage;
