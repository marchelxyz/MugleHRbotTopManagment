// frontend/src/pages/admin/stats/LoginActivityPage.jsx

import React, { useState, useEffect } from 'react';
import { getLoginActivityStats } from '../../../api';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Принимаем startDate и endDate как props
const LoginActivityPage = ({ startDate, endDate }) => {
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                setError(null);
                // Передаем даты в API вызов
                const response = await getLoginActivityStats(startDate, endDate);
                const stats = response.data.hourly_stats;
                
                console.log('LoginActivityPage: получены данные:', { startDate, endDate, stats });
                
                const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
                // stats - это объект вида {0: 5, 1: 3, ...}, а не массив
                // Проверяем оба варианта: числовой ключ и строковый ключ
                const dataPoints = labels.map((label, index) => {
                    const value = stats[index] ?? stats[String(index)] ?? stats[index.toString()] ?? 0;
                    return value;
                });
                
                console.log('LoginActivityPage: dataPoints:', dataPoints);

                setChartData({
                    labels,
                    datasets: [{
                        label: 'Количество заходов',
                        data: dataPoints,
                        backgroundColor: '#36A2EB',
                        borderRadius: 5,
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
    // Добавляем startDate и endDate в зависимости, чтобы график обновлялся
    }, [startDate, endDate]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            title: {
                display: true,
                text: 'Активность входов в приложение (по часам)',
                font: { size: 16 }
            },
        },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
    };

    if (loading) return <p>Загрузка графика...</p>;
    if (error) return <p style={{ color: 'red' }}>{error}</p>;
    if (!chartData) return <p>Нет данных для отображения</p>;

    return (
        <div>
            <h2>Активность по заходам</h2>
            <div style={{ height: '300px', marginTop: '20px' }}>
                <Bar options={options} data={chartData} />
            </div>
        </div>
    );
};

export default LoginActivityPage;
