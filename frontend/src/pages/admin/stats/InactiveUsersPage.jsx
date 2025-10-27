// frontend/src/pages/admin/stats/InactiveUsersPage.jsx

import React, { useState, useEffect } from 'react';
import { getInactiveUsers } from '../../../api';
import styles from './InactiveUsersPage.module.css';
import UserAvatar from '../../../components/UserAvatar'; // Используем твой компонент аватара

const InactiveUsersPage = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await getInactiveUsers();
                setUsers(response.data.users);
            } catch (err) {
                setError('Не удалось загрузить список неактивных пользователей.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    if (loading) {
        return <p>Загрузка списка...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    return (
        <div>
            <h2>Неактивные пользователи</h2>
            <p style={{ color: '#6E7A85', marginTop: '-10px', marginBottom: '20px' }}>
                Пользователи, которые ни разу не отправляли и не получали "спасибо".
            </p>

            {users && users.length > 0 ? (
                <ul className={styles.userList}>
                    {users.map(user => (
                        <li key={user.id} className={styles.userCard}>
                            <div className={styles.avatarContainer}>
                                <UserAvatar user={user} size="medium" />
                            </div>
                            <div className={styles.userInfo}>
                                <div className={styles.userName}>{`${user.first_name} ${user.last_name}`}</div>
                                <div className={styles.userPosition}>{user.position}</div>
                            </div>
                        </li>
                    ))}
                </ul>
            ) : (
                <div className={styles.noInactiveMessage}>
                    🎉 Отличные новости! Все пользователи активны.
                </div>
            )}
        </div>
    );
};

export default InactiveUsersPage;
