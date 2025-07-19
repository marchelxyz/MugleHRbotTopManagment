// frontend/src/pages/HomePage.jsx

import React, { useState, useEffect } from 'react';
import { getFeed } from '../api'; // Убедитесь, что путь '../api' правильный
import styles from './HomePage.module.css'; // 1. Импортируем стили

function HomePage({ user, onNavigate }) {
  const [feed, setFeed] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const feedResponse = await getFeed();
        setFeed(feedResponse.data);
      } catch (error) {
        console.error("Failed to fetch data for home page", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    // 2. Применяем классы
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>{user.first_name}, добро пожаловать!</h1>
        <p className={styles.balance}>Ваш баланс: <strong>{user.balance}</strong> баллов</p>
      </div>
      
      <button 
        onClick={() => onNavigate('transfer')} 
        className={styles.transferButton}
      >
        Передать баллы
      </button>

      <div>
        <h3>💬 Последняя активность</h3>
        {isLoading ? <p>Загрузка ленты...</p> : (
          feed.length > 0 ? (
            feed.map((item, index) => (
              <div key={index} className={styles.feedItem}>
                <p className={styles.feedTransaction}><strong>{item.sender.last_name}</strong> &rarr; <strong>{item.receiver.last_name}</strong>: {item.amount} баллов</p>
                <p className={styles.feedMessage}>"{item.message}"</p>
              </div>
            ))
          ) : <p>Пока не было переводов.</p>
        )}
      </div>
    </div>
  );
}

export default HomePage;
