// frontend/src/pages/admin/stats/HourlyActivityPage.jsx

import React, { useState, useEffect } from 'react';
import { getHourlyActivityStats } from '../../../api'; // Наша функция из api.js
import { Bar } from 'react-chartjs-2'; // Компонент для столбчатой диаграммы
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// **Шаг 1: Регистрация компонентов графика**
// Это нужно, чтобы React знал, какие части графика мы будем использовать.
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

const HourlyActivityPage = () => {
  // **Шаг 2: Создаем состояния для данных, загрузки и ошибок**
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // **Шаг 3: Загружаем данные при открытии страницы**
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await getHourlyActivityStats();
        
        // **Шаг 4: Подготавливаем данные для графика**
        const stats = response.data.hourly_stats;
        
        // Создаем массив с часами от 00:00 до 23:00 для подписей по оси X
        const labels = Array.from({ length: 24 }, (_, i) => {
            const hour = i.toString().padStart(2, '0');
            return `${hour}:00`;
        });
        
        // Создаем массив со значениями (количеством транзакций) для каждого часа
        const dataPoints = labels.map((label, index) => stats[index] || 0);

        setChartData({
          labels,
          datasets: [
            {
              label: 'Количество "спасибо"',
              data: dataPoints,
              backgroundColor: '#5CA14A', // Зеленый цвет для столбиков
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
  }, []); // Пустой массив означает, что эффект выполнится только один раз

  // **Шаг 5: Настраиваем внешний вид графика**
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // Скрываем легенду (надпись "Количество спасибо")
      },
      title: {
        display: true,
        text: 'Средняя активность по часам за последние 30 дней',
        font: {
          size: 16,
        }
      },
    },
    scales: {
        y: {
            beginAtZero: true,
            ticks: {
                // Оставляем только целые числа на оси Y
                precision: 0, 
            }
        }
    }
  };
  
  // **Шаг 6: Отображаем результат**
  if (loading) {
    return <p>Загрузка графика...</p>;
  }

  if (error) {
    return <p style={{ color: 'red' }}>{error}</p>;
  }

  return (
    <div>
      <h2>Активность по часам</h2>
      <div style={{ height: '300px', marginTop: '20px' }}>
        {chartData && <Bar options={options} data={chartData} />}
      </div>
    </div>
  );
};

export default HourlyActivityPage;
