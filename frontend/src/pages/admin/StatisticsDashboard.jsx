// frontend/src/pages/admin/StatisticsDashboard.jsx

import React, { useState } from 'react';
import styles from './StatisticsDashboard.module.css';
import { FaChartBar, FaHourglassHalf, FaStar, FaChartLine, FaUsersSlash, FaCoins, FaSignInAlt, FaChartPie, FaFileExcel, FaClock } from 'react-icons/fa';
import DateRangePicker from '../../components/DateRangePicker';
import { exportConsolidatedReport } from '../../api';

// Импорты всех компонентов-отчётов
import GeneralStats from './stats/GeneralStats';
import HourlyActivityPage from './stats/HourlyActivityPage';
import UserEngagementPage from './stats/UserEngagementPage';
import PopularItemsPage from './stats/PopularItemsPage';
import InactiveUsersPage from './stats/InactiveUsersPage';
import EconomyBalancePage from './stats/EconomyBalancePage';
import LoginActivityPage from './stats/LoginActivityPage';
import ActiveUserRatioPage from './stats/ActiveUserRatioPage';
import AverageSessionDurationPage from './stats/AverageSessionDurationPage'; // <-- Новый

const StatisticsDashboard = () => {
    const [activeTab, setActiveTab] = useState('general');
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [isExporting, setIsExporting] = useState(false);

    const formatDateForApi = (date) => {
        if (!date) return null;
        return date.toISOString().split('T')[0];
    };
    
    const handleConsolidatedExport = async () => {
        setIsExporting(true);
        try {
            const formattedStartDate = formatDateForApi(startDate);
            const formattedEndDate = formatDateForApi(endDate);
            
            const response = await exportConsolidatedReport(formattedStartDate, formattedEndDate);
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `consolidated_report.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Ошибка при экспорте сводного отчета:', err);
            alert('Не удалось скачать сводный отчет.');
        } finally {
            setIsExporting(false);
        }
    };

    const tabs = [
        { id: 'general', label: 'Общая', icon: <FaChartBar />, dateDependent: true },
        { id: 'duration', label: 'Время сессии', icon: <FaClock />, dateDependent: true },
        { id: 'hourly', label: 'Спасибо', icon: <FaHourglassHalf />, dateDependent: true },
        // { id: 'logins', label: 'Заходы', icon: <FaSignInAlt />, dateDependent: true },
        { id: 'ratio', label: 'Акт/Неакт', icon: <FaChartPie />, dateDependent: false },
        { id: 'engagement', label: 'Лидеры', icon: <FaStar />, dateDependent: false },
        { id: 'popular', label: 'Товары', icon: <FaChartLine />, dateDependent: false },
        { id: 'inactive', label: 'Неактивные', icon: <FaUsersSlash />, dateDependent: false },
        { id: 'economy', label: 'Экономика', icon: <FaCoins />, dateDependent: false },
    ];

    const renderActiveComponent = () => {
        const dateProps = {
            startDate: formatDateForApi(startDate),
            endDate: formatDateForApi(endDate)
        };
        switch (activeTab) {
            case 'general': return <GeneralStats {...dateProps} />;
            case 'duration': return <AverageSessionDurationPage {...dateProps} />; // <-- Новый
            case 'hourly': return <HourlyActivityPage {...dateProps} />;
            // case 'logins': return <LoginActivityPage {...dateProps} />;
            case 'ratio': return <ActiveUserRatioPage />;
            case 'engagement': return <UserEngagementPage />;
            case 'popular': return <PopularItemsPage />;
            case 'inactive': return <InactiveUsersPage />;
            case 'economy': return <EconomyBalancePage />;
            default: return <GeneralStats {...dateProps} />;
        }
    };

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

            <div className={styles.controlsContainer}>
                {isDateFilterVisible && (
                    <DateRangePicker 
                        startDate={startDate}
                        setStartDate={setStartDate}
                        endDate={endDate}
                        setEndDate={setEndDate}
                    />
                )}
                <button
                    className={styles.consolidatedExportButton}
                    onClick={handleConsolidatedExport}
                    disabled={isExporting}
                >
                    <FaFileExcel />
                    {isExporting ? 'Формируем отчет...' : 'Скачать сводный отчет'}
                </button>
            </div> {/* <-- ВОТ ЭТОТ ЗАКРЫВАЮЩИЙ ТЕГ БЫЛ ПРОПУЩЕН */}

            <div className={styles.content}>
                {renderActiveComponent()}
            </div>
        </div>
    );
};

export default StatisticsDashboard;
