// frontend/src/pages/HistoryPage.jsx

import React, { useState, useEffect } from 'react';
import { getUserTransactions } from '../api';
import styles from './HistoryPage.module.css';
import PageLayout from '../components/PageLayout';
import { formatToMsk } from '../utils/dateFormatter'; // <-- 1. ИМПОРТИРУЕМ НАШУ ФУНКЦИЮ

function HistoryPage({ user, onBack }) {
    const [transactions, setTransactions] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchTransactions = async () => {
                try {
                    const response = await getUserTransactions(user.id);
                    setTransactions(response.data);
                } catch (error) {
                    console.error("Failed to fetch transactions", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchTransactions();
        }
    }, [user]);

    return (
        <PageLayout title="История">
            <button onClick={onBack} className={styles.backButton}>&larr; Назад</button>
            
            {isLoading ? <p>Загрузка...</p> : (
                transactions.length > 0 ? (
                    <div className={styles.list}>
                        {transactions.map(tx => (
                            <div key={tx.id} className={`${styles.transactionItem} ${tx.sender.id === user.id ? styles.outgoingBorder : styles.incomingBorder}`}>
                                {tx.sender.id === user.id ? (
                                    <p>
                                        <span className={styles.outgoing}>Вы отправили</span>
                                        <strong> {tx.amount} баллов</strong>
                                        <span> {tx.receiver.first_name} {tx.receiver.last_name}</span>
                                    </p>
                                ) : (
                                    <p>
                                        <span className={styles.incoming}>Вы получили</span>
                                        <strong> {tx.amount} баллов</strong>
                                        <span> от {tx.sender.first_name} {tx.sender.last_name}</span>
                                    </p>
                                )}
                                {tx.message && <p className={styles.message}>"{tx.message}"</p>}
                                {/* --- 2. ИСПОЛЬЗУЕМ formatToMsk --- */}
                                <p className={styles.timestamp}>{formatToMsk(tx.timestamp)}</p>
                            </div>
                        ))}
                    </div>
                ) : <p>У вас пока нет транзакций.</p>
            )}
        </PageLayout>
    );
}

export default HistoryPage;
