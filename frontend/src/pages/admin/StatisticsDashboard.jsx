// frontend/src/pages/admin/StatisticsDashboard.jsx

import React, { useState } from 'react';
import styles from './StatisticsDashboard.module.css';
// --- ИСПРАВЛЕНИЕ №1: Меняем FaPieChart на FaChartPie ---
import { FaChartBar, FaHourglassHalf, FaStar, FaChartLine, FaUsersSlash, FaCoins, FaSignInAlt, FaChartPie } from 'react-icons/fa';
import DateRangePicker from '../../components/DateRangePicker'; // <-- Импортируем наш календарь

// Импортируем ВСЕ наши компоненты-отчёты
import GeneralStats from './stats/GeneralStats';
import HourlyActivityPage from './stats/HourlyActivityPage';
import UserEngagementPage from './stats/UserEngagementPage';
import PopularItemsPage from './stats/PopularItemsPage';
import InactiveUsersPage from './stats/InactiveUsersPage';
import EconomyBalancePage from './stats/EconomyBalancePage';
import LoginActivityPage from './stats/LoginActivityPage';
import ActiveUserRatioPage from './stats/ActiveUserRatioPage';

const StatisticsDashboard = () => {
    const [activeTab, setActiveTab] = useState('general');

    // --- НОВОЕ: Состояние для дат ---
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    // Функция для форматирования даты в строку 'YYYY-MM-DD'
    const formatDateForApi = (date) => {
        if (!date) return null;
        return date.toISOString().split('T')[0];
    };

    const tabs = [
        { id: 'general', label: 'Общая', icon: <FaChartBar /> },
        { id: 'hourly', label: 'Спасибо', icon: <FaHourglassHalf /> },
        { id: 'logins', label: 'Заходы', icon: <FaSignInAlt /> },
        // --- ИСПРАВЛЕНИЕ №2: Меняем FaPieChart на FaChartPie ---
        { id: 'ratio', label: 'Акт/Неакт', icon: <FaChartPie /> },
        { id: 'engagement', label: 'Лидеры', icon: <FaStar /> },
        { id: 'popular', label: 'Товары', icon: <FaChartLine /> },
        { id: 'inactive', label: 'Неактивные', icon: <FaUsersSlash /> },
        { id: 'economy', label: 'Экономика', icon: <FaCoins /> },
    ];

    const renderActiveComponent = () => {
        // --- НОВОЕ: Передаем даты в дочерние компоненты ---
        const dateProps = {
            startDate: formatDateForApi(startDate),
            endDate: formatDateForApi(endDate)
        };
        
        switch (activeTab) {
            case 'general': return <GeneralStats {...dateProps} />;
            case 'hourly': return <HourlyActivityPage {...dateProps} />;
            case 'logins': return <LoginActivityPage {...dateProps} />;
            case 'ratio': return <ActiveUserRatioPage />;
            case 'engagement': return <UserEngagementPage />;
            case 'popular': return <PopularItemsPage />;
            case 'inactive': return <InactiveUsersPage />;
            case 'economy': return <EconomyBalancePage />;
            default: return <GeneralStats {...dateProps} />;
        }
    };

    // Определяем, нужно ли показывать календарь для текущей вкладки
    const isDateFilterVisible = tabs.find(tab => tab.id === activeTab)?.dateDependent;

    return (
        <div className={styles.statsContainer}>
            <div className={styles.tabsContainer}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : styles.tabCollapsed}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        <span className={styles.tabIcon}>{tab.icon}</span>
                        <span className={styles.tabLabel}>{tab.label}</span>
                    </button>
                ))}
            </div>

            {/* --- НОВОЕ: Отображаем календарь, если нужно --- */}
            {isDateFilterVisible && (
                <DateRangePicker 
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                />
            )}
            
            <div className={styles.content}>
                {renderActiveComponent()}
            </div>
        </div>
    );
};

export default StatisticsDashboard;
