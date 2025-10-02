// frontend/src/pages/admin/stats/GeneralStats.jsx

import React, { useState, useEffect } from 'react';
import { getGeneralStats } from '../../../api'; 
import styles from '../StatisticsDashboard.module.css'; // Используем те же стили

const StatCard = ({ title, value }) => (
    <div className={styles.statCard}>
        <h4>{title}</h4>
        <p>{value}</p>
    </div>
);

const GeneralStats = () => {
    const [stats, setStats] = useState(null);
    const [period, setPeriod] = useState('day');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                const data = await getGeneralStats(period);
                setStats(data);
            } catch (error) {
                console.error("Failed to fetch general stats:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, [period]);

    if (loading) {
        return <p>Загрузка...</p>;
    }

    return (
        <div>
            <h2>Общая статистика</h2>
            <div className={styles.periodSelector}>
                <button onClick={() => setPeriod('day')} className={period === 'day' ? styles.activePeriod : ''}>День</button>
                <button onClick={() => setPeriod('week')} className={period === 'week' ? styles.activePeriod : ''}>Неделя</button>
                <button onClick={() => setPeriod('month')} className={period === 'month' ? styles.activePeriod : ''}>Месяц</button>
                <button onClick={() => setPeriod('year')} className={period === 'year' ? styles.activePeriod : ''}>Год</button>
            </div>
            <div className={styles.statsGrid}>
                {stats && (
                    <>
                        <StatCard title="Новые пользователи" value={stats.new_users_count} />
                        <StatCard title="Активные пользователи" value={stats.active_users_count} />
                        <StatCard title="Всего транзакций" value={stats.transactions_count} />
                        <StatCard title="Оборот" value={`${stats.total_turnover} спасибок`} />
                        <StatCard title="Покупок в магазине" value={stats.store_purchases_count} />
                        <StatCard title="Потрачено в магазине" value={`${stats.total_store_spent} спасибок`} />
                    </>
                )}
            </div>
        </div>
    );
};

export default GeneralStats;
