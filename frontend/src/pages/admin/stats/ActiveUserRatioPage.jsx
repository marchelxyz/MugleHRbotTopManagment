// frontend/src/pages/admin/stats/ActiveUserRatioPage.jsx

import React, { useState, useEffect } from 'react';
import { getActiveUserRatio } from '../../../api';
import { Doughnut } from 'react-chartjs-2'; // Используем "бублик"
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend); // Регистрируем другие компоненты

const ActiveUserRatioPage = () => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await getActiveUserRatio();
                const { active_users, inactive_users } = response.data;

                setChartData({
                    labels: ['Активные', 'Неактивные'],
                    datasets: [{
                        label: 'Пользователи',
                        data: [active_users, inactive_users],
                        backgroundColor: ['#5CA14A', '#E9EEF2'],
                        borderColor: ['#FFFFFF', '#FFFFFF'],
                        borderWidth: 2,
                    }],
                });
            } catch (err) {
                setError('Не удалось загрузить данные.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%', // Делаем диаграмму "бубликом"
        plugins: {
            legend: {
                position: 'bottom',
            },
            title: {
                display: true,
                text: 'Соотношение активных и неактивных пользователей',
                font: { size: 16 }
            },
        },
    };

    if (loading) return <p>Загрузка диаграммы...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;

    return (
        <div>
            <h2>Соотношение Активные/Неактивные</h2>
            <div style={{ height: '350px', marginTop: '20px', position: 'relative' }}>
                {chartData && <Doughnut options={options} data={chartData} />}
            </div>
        </div>
    );
};

export default ActiveUserRatioPage;
