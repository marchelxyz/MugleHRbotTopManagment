// frontend/src/pages/admin/stats/AverageSessionDurationPage.jsx

import React, { useState, useEffect } from 'react';
import { getAverageSessionDuration } from '../../../api';
// Скопируем стили из EconomyBalancePage для единообразия
import styles from './EconomyBalancePage.module.css'; 

const AverageSessionDurationPage = ({ startDate, endDate }) => {
    const [duration, setDuration] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await getAverageSessionDuration(startDate, endDate);
                setDuration(response.data.average_duration_minutes);
            } catch (err) {
                setError('Не удалось загрузить данные.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [startDate, endDate]);

    if (loading) return <p>Загрузка данных...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;

    return (
        <div>
            <h2>Среднее время сессии</h2>
            <p style={{ color: '#6E7A85', marginTop: '-10px', marginBottom: '20px' }}>
                Средняя длительность одного визита пользователя в приложение за выбранный период.
            </p>
            <div className={styles.card}>
                <p className={styles.value}>{duration.toFixed(2)}</p>
                <p className={styles.label}>минут на пользователя</p>
            </div>
        </div>
    );
};

export default AverageSessionDurationPage;
