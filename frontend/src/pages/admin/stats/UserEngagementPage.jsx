// frontend/src/pages/admin/stats/UserEngagementPage.jsx

import React, { useState, useEffect } from 'react';
import { getUserEngagementStats, exportUserEngagement } from '../../../api';
import styles from './UserEngagementPage.module.css';
import UserAvatar from '../../../components/UserAvatar';
import { FaDownload } from 'react-icons/fa';

// --- ИСПРАВЛЕНИЕ: Компонент LeaderList вынесен сюда и определен только ОДИН раз ---
const LeaderList = ({ title, users }) => (
    <div className={styles.listContainer}>
        <h3>{title}</h3>
        <ul className={styles.list}>
            {users && users.length > 0 ? (
                users.map(({ user, count }) => (
                    <li key={user.id} className={styles.listItem}>
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

const UserEngagementPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

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
    
    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await exportUserEngagement();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'leaders_report.xlsx');
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Ошибка при экспорте:', err);
            alert('Не удалось скачать отчет.');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) { return <p>Загрузка лидеров...</p>; }
    if (error) { return <p style={{ color: 'red' }}>{error}</p>; }

    return (
        <div>
            <div className={styles.header}>
                <h2>Лидеры вовлеченности</h2>
                <button 
                    className={styles.exportButton} 
                    onClick={handleExport} 
                    disabled={isExporting}
                >
                    <FaDownload />
                    {isExporting ? 'Экспорт...' : 'Скачать'}
                </button>
            </div>
            <div className={styles.container}>
                {/* Теперь мы просто используем компонент LeaderList, а не объявляем его заново */}
                <LeaderList title="Топ-5 Отправителей" users={stats?.top_senders} />
                <LeaderList title="Топ-5 Получателей" users={stats?.top_receivers} />
            </div>
        </div>
    );
};

export default UserEngagementPage;
