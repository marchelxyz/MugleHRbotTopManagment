// frontend/src/pages/admin/stats/HourlyActivityPage.jsx

import React, { useState, useEffect } from 'react';
import { getHourlyActivityStats } from '../../../api';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Принимаем startDate и endDate как props
const HourlyActivityPage = ({ startDate, endDate }) => {
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Передаем даты в API вызов
        const response = await getHourlyActivityStats(startDate, endDate);
        const stats = response.data.hourly_stats;
        
        const labels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
        const dataPoints = labels.map((label, index) => stats[index] || 0);

        setChartData({
          labels,
          datasets: [
            {
              label: 'Количество "спасибо"',
              data: dataPoints,
              backgroundColor: '#5CA14A',
              borderRadius: 5,
            },
          ],
        });

      } catch (err) {
        setError('Не удалось загрузить данные. Попробуйте позже.');
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
        text: 'Активность по "спасибо" (по часам)',
        font: { size: 16 }
      },
    },
    scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
  };
  
  if (loading) {
    return <p>Загрузка графика...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  return (
    <div>
      <h2>Активность по "спасибо"</h2>
      <div style={{ height: '300px', marginTop: '20px' }}>
        {chartData && <Bar options={options} data={chartData} />}
      </div>
    </div>
  );
};

export default HourlyActivityPage;
