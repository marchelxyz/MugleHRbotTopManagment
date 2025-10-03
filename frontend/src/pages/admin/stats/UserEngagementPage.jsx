// frontend/src/pages/admin/stats/UserEngagementPage.jsx

import React, { useState, useEffect } from 'react';
import { getUserEngagementStats } from '../../../api';
import styles from './UserEngagementPage.module.css';
import UserAvatar from '../../../components/UserAvatar'; // <-- ИМПОРТИРУЕМ ТВОЙ КОМПОНЕНТ

const UserEngagementPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await getUserEngagementStats();
                setStats(response.data);
            } catch (err) {
                setError('Не удалось загрузить данные о лидерах.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    if (loading) {
        return <p>Загрузка лидеров...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    const LeaderList = ({ title, users }) => (
        <div className={styles.listContainer}>
            <h3>{title}</h3>
            <ul className={styles.list}>
                {users && users.length > 0 ? (
                    users.map(({ user, count }) => (
                        <li key={user.id} className={styles.listItem}>
                            {/* --- ИЗМЕНЕНИЕ ЗДЕСЬ: ИСПОЛЬЗУЕМ UserAvatar --- */}
                            <div className={styles.avatarContainer}>
                                <UserAvatar user={user} size="small" />
                            </div>
                            <div className={styles.userInfo}>
                                <div className={styles.userName}>{`${user.first_name} ${user.last_name}`}</div>
                                <div className={styles.userPosition}>{user.position}</div>
                            </div>
                            <div className={styles.count}>{count}</div>
                        </li>
                    ))
                ) : (
                    <p>Нет данных</p>
                )}
            </ul>
        </div>
    );

    return (
        <div>
            <h2>Лидеры вовлеченности</h2>
            <div className={styles.container}>
                <LeaderList title="Топ-5 Отправителей" users={stats?.top_senders} />
                <LeaderList title="Топ-5 Получателей" users={stats?.top_receivers} />
            </div>
        </div>
    );
};

export default UserEngagementPage;
