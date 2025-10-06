// frontend/src/pages/HistoryPage.jsx

import React, { useState, useEffect } from 'react';
import { getUserHistory } from '../api';
import { useAuth } from '../contexts/AuthContext';
import styles from './HistoryPage.module.css';
import PageLayout from '../components/PageLayout';
import UserAvatar from '../components/UserAvatar';
import { formatToMsk } from '../utils/dateFormatter'; // <-- 1. Импортируем нашу функцию

const HistoryPage = () => {
    const { user } = useAuth();
    const [history, setHistory] = useState({ sent: [], received: [] });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchHistory = async () => {
                try {
                    const response = await getUserHistory(user.id);
                    setHistory(response.data);
                } catch (error) {
                    console.error("Failed to fetch history:", error);
                } finally {
                    setLoading(false);
                }
            };
            fetchHistory();
        }
    }, [user]);

    if (loading) {
        return <PageLayout title="История"><p>Загрузка...</p></PageLayout>;
    }

    const renderTransactionRow = (transaction, type) => {
        const isSent = type === 'sent';
        const otherUser = isSent ? transaction.receiver : transaction.sender;
        const amountClass = isSent ? styles.sent : styles.received;

        return (
            <tr key={transaction.id}>
                <td>
                    <div className={styles.userCell}>
                        <UserAvatar user={otherUser} size="small" />
                        <span>{otherUser.first_name} {otherUser.last_name}</span>
                    </div>
                </td>
                <td className={amountClass}>
                    {isSent ? '-' : '+'} {transaction.amount}
                </td>
                {/* --- 2. ИСПОЛЬЗУЕМ formatToMsk --- */}
                <td className={styles.timestamp}>{formatToMsk(transaction.timestamp)}</td>
            </tr>
        );
    };

    return (
        <PageLayout title="История транзакций">
            <div className={styles.historyContainer}>
                <h2>Полученные</h2>
                <table className={styles.historyTable}>
                    <tbody>
                        {history.received.map(t => renderTransactionRow(t, 'received'))}
                    </tbody>
                </table>

                <h2 className={styles.sentTitle}>Отправленные</h2>
                <table className={styles.historyTable}>
                    <tbody>
                        {history.sent.map(t => renderTransactionRow(t, 'sent'))}
                    </tbody>
                </table>
            </div>
        </PageLayout>
    );
};

export default HistoryPage;
