import React, { useState, useEffect } from 'react';
import { getGeneralStats } from '../../api';
import styles from './StatisticsDashboard.module.css';
import { FaUsers, FaSyncAlt, FaUserCheck, FaShoppingBag, FaGift, FaMoneyBillWave } from 'react-icons/fa';

// Компонент для отображения одной карточки статистики
const StatCard = ({ icon, title, value, color }) => (
  <div className={styles.statCard} style={{ '--card-color': color }}>
    <div className={styles.cardIcon}>{icon}</div>
    <div className={styles.cardContent}>
      <span className={styles.cardValue}>{value}</span>
      <span className={styles.cardTitle}>{title}</span>
    </div>
  </div>
);

function StatisticsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(7); // Период по умолчанию - 7 дней

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await getGeneralStats(period);
        setStats(response.data);
      } catch (error) {
        console.error("Не удалось загрузить статистику:", error);
        // Здесь можно добавить уведомление об ошибке
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [period]); // Перезапрашивать статистику при смене периода

  return (
    <div className={styles.dashboardContainer}>
      <div className={styles.header}>
        <h2>Общая статистика</h2>
        <div className={styles.periodSelector}>
          <button onClick={() => setPeriod(7)} className={period === 7 ? styles.active : ''}>Неделя</button>
          <button onClick={() => setPeriod(30)} className={period === 30 ? styles.active : ''}>Месяц</button>
          <button onClick={() => setPeriod(90)} className={period === 90 ? styles.active : ''}>3 месяца</button>
          <button onClick={() => setPeriod(365)} className={period === 365 ? styles.active : ''}>Год</button>
        </div>
      </div>

      {loading ? (
        <p>Загрузка статистики...</p>
      ) : stats ? (
        <div className={styles.statsGrid}>
          <StatCard icon={<FaUsers />} title="Новые пользователи" value={stats.new_users_count} color="#3498db" />
          <StatCard icon={<FaUserCheck />} title="Активные пользователи" value={stats.active_users_count} color="#2ecc71" />
          <StatCard icon={<FaGift />} title="Всего транзакций" value={stats.transactions_count} color="#e67e22" />
          <StatCard icon={<FaSyncAlt />} title="Оборот 'спасибок'" value={stats.total_turnover} color="#f1c40f" />
          <StatCard icon={<FaShoppingBag />} title="Покупок в магазине" value={stats.store_purchases_count} color="#9b59b6" />
          <StatCard icon={<FaMoneyBillWave />} title="Потрачено в магазине" value={stats.total_store_spent} color="#e74c3c" />
        </div>
      ) : (
        <p>Не удалось загрузить данные.</p>
      )}
    </div>
  );
}

export default StatisticsDashboard;
