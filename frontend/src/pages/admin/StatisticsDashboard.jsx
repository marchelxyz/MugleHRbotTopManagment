// frontend/src/pages/admin/StatisticsDashboard.jsx

import React, { useState } from 'react';
import styles from './StatisticsDashboard.module.css';
import { FaChartBar, FaHourglassHalf, FaStar, FaChartLine, FaUsersSlash, FaCoins, FaSignInAlt, FaChartPie } from 'react-icons/fa';
import DateRangePicker from '../../components/DateRangePicker';
import { exportConsolidatedReport } from '../../api'; // <-- Импортируем новую функцию

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
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    const [isExporting, setIsExporting] = useState(false); // Состояние для кнопки экспорта

    // Функция для форматирования даты в строку 'YYYY-MM-DD' для API
    const formatDateForApi = (date) => {
        if (!date) return null;
        return date.toISOString().split('T')[0];
    };

    // --- НОВАЯ ФУНКЦИЯ ДЛЯ СКАЧИВАНИЯ СВОДНОГО ОТЧЁТА ---
    const handleConsolidatedExport = async () => {
        setIsExporting(true);
        try {
            const formattedStartDate = formatDateForApi(startDate);
            const formattedEndDate = formatDateForApi(endDate);
            
            const response = await exportConsolidatedReport(formattedStartDate, formattedEndDate);
            
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            // Имя файла будет сформировано на бэкенде, но мы можем задать запасное
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
    
    // Описываем все вкладки и указываем, зависит ли она от даты
    const tabs = [
        { id: 'general', label: 'Общая', icon: <FaChartBar />, dateDependent: true },
        { id: 'hourly', label: 'Спасибо', icon: <FaHourglassHalf />, dateDependent: true },
        { id: 'logins', label: 'Заходы', icon: <FaSignInAlt />, dateDependent: true },
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

    // Проверяем, нужно ли показывать календарь для текущей активной вкладки
    const isDateFilterVisible = tabs.find(tab => tab.id === activeTab)?.dateDependent;

    return (
        <div className={styles.statsContainer}>
            <div className={styles.tabsContainer}>
                {/* --- ВОТ ИСПРАВЛЕНИЕ: Добавляем отрисовку кнопок --- */}
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

            {/* Отображаем календарь, если он нужен для этой вкладки */}
            {isDateFilterVisible && (
                <DateRangePicker 
                    startDate={startDate}
                    setStartDate={setStartDate}
                    endDate={endDate}
                    setEndDate={setEndDate}
                />
            )}
                {/* --- НОВАЯ КНОПКА СКАЧИВАНИЯ --- */}
                <button
                    className={styles.consolidatedExportButton}
                    onClick={handleConsolidatedExport}
                    disabled={isExporting}
                >
                    <FaFileExcel />
                    {isExporting ? 'Формируем отчет...' : 'Скачать сводный отчет'}
                </button>
            </div>

            <div className={styles.content}>
                {renderActiveComponent()}
            </div>
        </div>
    );
};

export default StatisticsDashboard;
