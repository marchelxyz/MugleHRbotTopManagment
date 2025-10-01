// frontend/src/pages/admin/StatisticsDashboard.jsx

import React, { useState } from 'react';
import styles from './StatisticsDashboard.module.css';

// Импортируем наши компоненты-отчёты
import GeneralStats from './stats/GeneralStats'; // Мы создадим его на основе твоего старого дашборда
import HourlyActivityPage from './stats/HourlyActivityPage';
import UserEngagementPage from './stats/UserEngagementPage';
import PopularItemsPage from './stats/PopularItemsPage';
import InactiveUsersPage from './stats/InactiveUsersPage';
import EconomyBalancePage from './stats/EconomyBalancePage';


const StatisticsDashboard = () => {
    // Состояние для отслеживания активного таба
    const [activeTab, setActiveTab] = useState('general');

    // Функция для рендеринга активного компонента
    const renderActiveComponent = () => {
        switch (activeTab) {
            case 'general':
                return <GeneralStats />;
            case 'hourly':
                return <HourlyActivityPage />;
            case 'engagement':
                return <UserEngagementPage />;
            case 'popular':
                return <PopularItemsPage />;
            case 'inactive':
                return <InactiveUsersPage />;
            case 'economy':
                return <EconomyBalancePage />;
            default:
                return <GeneralStats />;
        }
    };

    return (
        <div className={styles.statsContainer}>
            <div className={styles.tabs}>
                <button 
                    className={activeTab === 'general' ? styles.active : ''}
                    onClick={() => setActiveTab('general')}
                >
                    Общая
                </button>
                <button 
                    className={activeTab === 'hourly' ? styles.active : ''}
                    onClick={() => setActiveTab('hourly')}
                >
                    Активность
                </button>
                <button 
                    className={activeTab === 'engagement' ? styles.active : ''}
                    onClick={() => setActiveTab('engagement')}
                >
                    Лидеры
                </button>
                <button 
                    className={activeTab === 'popular' ? styles.active : ''}
                    onClick={() => setActiveTab('popular')}
                >
                    Товары
                </button>
                 <button 
                    className={activeTab === 'inactive' ? styles.active : ''}
                    onClick={() => setActiveTab('inactive')}
                >
                    Неактивные
                </button>
                 <button 
                    className={activeTab === 'economy' ? styles.active : ''}
                    onClick={() => setActiveTab('economy')}
                >
                    Экономика
                </button>
            </div>
            <div className={styles.content}>
                {renderActiveComponent()}
            </div>
        </div>
    );
};

export default StatisticsDashboard;
