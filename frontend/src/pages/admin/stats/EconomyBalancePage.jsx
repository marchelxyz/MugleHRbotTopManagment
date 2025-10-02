// frontend/src/pages/admin/stats/EconomyBalancePage.jsx

import React, { useState, useEffect } from 'react';
import { getTotalBalance } from '../../../api';
import styles from './EconomyBalancePage.module.css';

const EconomyBalancePage = () => {
    const [balance, setBalance] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await getTotalBalance();
                setBalance(response.data.total_balance);
            } catch (err) {
                setError('Не удалось загрузить данные о балансе.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Функция для красивого форматирования чисел (10000 -> 10 000)
    const formatNumber = (num) => {
        return num?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ") || "0";
    };

    if (loading) {
        return <p>Загрузка данных...</p>;
    }

    if (error) {
        return <p style={{ color: 'red' }}>{error}</p>;
    }

    return (
        <div>
            <h2>Баланс экономики</h2>
            <p style={{ color: '#6E7A85', marginTop: '-10px', marginBottom: '20px' }}>
                Общее количество "спасибок" на счетах всех пользователей.
            </p>
            <div className={styles.card}>
                <p className={styles.value}>{formatNumber(balance)}</p>
                <p className={styles.label}>спасибок в системе</p>
            </div>
        </div>
    );
};

export default EconomyBalancePage;
