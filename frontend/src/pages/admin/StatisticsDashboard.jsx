// frontend/src/pages/admin/StatisticsDashboard.jsx

import React, { useState } from 'react';
import styles from './StatisticsDashboard.module.css';
import { FaChartBar, FaHourglassHalf, FaStar, FaChartLine, FaUsersSlash, FaCoins } from 'react-icons/fa';

// Импортируем наши компоненты-отчёты
import GeneralStats from './stats/GeneralStats';
import HourlyActivityPage from './stats/HourlyActivityPage';
import UserEngagementPage from './stats/UserEngagementPage';
import PopularItemsPage from './stats/PopularItemsPage';
import InactiveUsersPage from './stats/InactiveUsersPage';
import EconomyBalancePage from './stats/EconomyBalancePage';
import LoginActivityPage from './LoginActivityPage';
import ActiveUserRatioPage from './ActiveUserRatioPage';

const StatisticsDashboard = () => {
    const [activeTab, setActiveTab] = useState('general');

    const tabs = [
        { id: 'general', label: 'Общая', icon: <FaChartBar /> },
        { id: 'hourly', label: 'Активность', icon: <FaHourglassHalf /> },
         { id: 'logins', label: 'Заходы', icon: <FaSignInAlt /> },
        { id: 'ratio', label: 'Акт/Неакт', icon: <FaPieChart /> },
        { id: 'engagement', label: 'Лидеры', icon: <FaStar /> },
        { id: 'popular', label: 'Товары', icon: <FaChartLine /> },
        { id: 'inactive', label: 'Неактивные', icon: <FaUsersSlash /> },
        { id: 'economy', label: 'Экономика', icon: <FaCoins /> },
    ];

    const renderActiveComponent = () => {
        switch (activeTab) {
            case 'general': return <GeneralStats />;
            case 'hourly': return <HourlyActivityPage />;
            case 'logins': return <LoginActivityPage />; // <-- Новый
            case 'ratio': return <ActiveUserRatioPage />; // <-- Новый
            case 'engagement': return <UserEngagementPage />;
            case 'popular': return <PopularItemsPage />;
            case 'inactive': return <InactiveUsersPage />;
            case 'economy': return <EconomyBalancePage />;
            default: return <GeneralStats />;
        }
    };

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
            <div className={styles.content}>
                {renderActiveComponent()}
            </div>
        </div>
    );
};

export default StatisticsDashboard;
