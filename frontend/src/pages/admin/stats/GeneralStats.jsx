// frontend/src/pages/admin/stats/GeneralStats.jsx

import React, { useState, useEffect } from 'react';
import { getGeneralStats } from '../../../api'; 
import styles from '../StatisticsDashboard.module.css';

// --- ИЗМЕНЕНИЕ: В StatCard добавляем проверку на null/undefined ---
const StatCard = ({ title, value }) => (
    <div className={styles.statCard}>
        <h4>{title}</h4>
        {/* Если value не пришло, показываем 0 */}
        <p>{value ?? 0}</p>
    </div>
);

const GeneralStats = ({ startDate, endDate }) => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            setLoading(true);
            try {
                // --- ИЗМЕНЕНИЕ: Передаем даты в API ---
                const response = await getGeneralStats(startDate, endDate);
                setStats(response.data);
            } catch (error) {
                console.error("Failed to fetch general stats:", error);
            } finally {
                setLoading(false);
            }
        };
        
        fetchStats();
    }, [startDate, endDate]);


    if (loading) {
        return <p>Загрузка...</p>;
    }

    return (
        <div>
            <h2>Общая статистика</h2>
            {/* Мы убираем старый переключатель День/Неделя/Месяц, так как теперь есть календарь */}

            <div className={styles.statsGrid}>
                {/* --- ИЗМЕНЕНИЕ: Теперь мы напрямую обращаемся к полям, и StatCard сам обработает undefined --- */}
                <StatCard title="Всего пользователей" value={stats?.new_users_count} />
                <StatCard title="Активные пользователи" value={stats?.active_users_count} />
                <StatCard title="Всего транзакций" value={stats?.transactions_count} />
                <StatCard title="Оборот" value={`${stats?.total_turnover ?? 0} спасибок`} />
                <StatCard title="Покупок в магазине" value={stats?.store_purchases_count} />
                <StatCard title="Потрачено в магазине" value={`${stats?.total_store_spent ?? 0} спасибок`} />
            </div>
        </div>
    );
};

export default GeneralStats;
