// frontend/src/pages/HistoryPage.jsx

import React, { useState, useEffect } from 'react';
import { getUserTransactions } from '../api';
import styles from './HistoryPage.module.css';
import { getPreloadedData } from '../preloader';

function HistoryPage({ user, onBack }) {
  // --- ИЗМЕНЕНИЕ: Пытаемся сразу получить данные из кэша ---
  const [transactions, setTransactions] = useState(() => getPreloadedData('history'));
  const [isLoading, setIsLoading] = useState(!transactions);
  
  useEffect(() => {
    // Если данные не были предзагружены, загружаем их как обычно
    if (!transactions && user) {
      const fetchTransactions = async () => {
        try {
          const response = await getUserTransactions(user.id);
          setTransactions(response.data);
        } catch (error) { console.error("Failed to fetch transactions", error); } 
        finally { setIsLoading(false); }
      };
      fetchTransactions();
    }
  }, [transactions, user]);

  return (
    <div className={styles.page}>
      <button onClick={onBack} className={styles.backButton}>&larr; Назад</button>
      <h1>История транзакций</h1>
      {isLoading ? <p>Загрузка...</p> : (
        transactions.length > 0 ? (
          <div className={styles.list}>
            {transactions.map(tx => (
              <div key={tx.id} className={styles.transactionItem}>
                {tx.sender_id === user.id ? (
                  <p>
                    <span className={styles.outgoing}>Вы отправили</span>
                    <strong> {tx.amount} баллов</strong>
                    <span> {tx.receiver.last_name}</span>
                  </p>
                ) : (
                  <p>
                    <span className={styles.incoming}>Вы получили</span>
                    <strong> {tx.amount} баллов</strong>
                    <span> от {tx.sender.last_name}</span>
                  </p>
                )}
                <p className={styles.message}>"{tx.message}"</p>
                <p className={styles.timestamp}>{new Date(tx.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : <p>У вас пока нет транзакций.</p>
      )}
    </div>
  );
}

export default HistoryPage;
