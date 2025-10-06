// frontend/src/pages/HistoryPage.jsx

import React, { useState, useEffect } from 'react';
import { getUserHistory } from '../api'; // Используем актуальную функцию API
import { useAuth } from '../contexts/AuthContext'; // Получаем пользователя из контекста
import styles from './HistoryPage.module.css';
import PageLayout from '../components/PageLayout';
import { formatToMsk } from '../utils/dateFormatter'; // Наша новая функция форматирования

const HistoryPage = () => {
    const { user } = useAuth(); // Получаем авторизованного пользователя
    const [history, setHistory] = useState({ sent: [], received: [] });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (user) {
            const fetchHistory = async () => {
                try {
                    const response = await getUserHistory(user.id);
                    setHistory(response.data);
                } catch (error) {
                    console.error("Failed to fetch history", error);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchHistory();
        }
    }, [user]);

    // Вспомогательный компонент для отрисовки одного списка
    const TransactionList = ({ transactions, type }) => {
        if (!transactions || transactions.length === 0) {
            return <p>У вас пока нет {type === 'sent' ? 'отправленных' : 'полученных'} транзакций.</p>;
        }

        return (
            <div className={styles.list}>
                {transactions.map(tx => {
                    const isSent = type === 'sent';
                    const otherUser = isSent ? tx.receiver : tx.sender;
                    
                    return (
                        <div key={tx.id} className={`${styles.transactionItem} ${isSent ? styles.outgoingBorder : styles.incomingBorder}`}>
                            {isSent ? (
                                <p>
                                    <span className={styles.outgoing}>Вы отправили</span>
                                    <strong> {tx.amount} баллов</strong>
                                    <span> {otherUser.first_name} {otherUser.last_name}</span>
                                </p>
                            ) : (
                                <p>
                                    <span className={styles.incoming}>Вы получили</span>
                                    <strong> {tx.amount} баллов</strong>
                                    <span> от {tx.sender.first_name} {tx.sender.last_name}</span>
                                </p>
                            )}
                            {tx.message && <p className={styles.message}>"{tx.message}"</p>}
                            <p className={styles.timestamp}>{formatToMsk(tx.timestamp)}</p>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <PageLayout title="История">
            {isLoading ? <p>Загрузка...</p> : (
                <>
                    <h2>Полученные</h2>
                    <TransactionList transactions={history.received} type="received" />
                    
                    <h2 className={styles.sentTitle}>Отправленные</h2>
                    <TransactionList transactions={history.sent} type="sent" />
                </>
            )}
        </PageLayout>
    );
}

export default HistoryPage;
