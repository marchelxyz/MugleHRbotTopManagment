// frontend/src/pages/AdminPage.jsx

import React, { useState } from 'react';
import styles from './AdminPage.module.css';
import PageLayout from '../components/PageLayout';

// Импортируем все дочерние компоненты
import BannerManager from './admin/BannerManager';
import ItemManager from './admin/ItemManager';
import UserManager from './admin/UserManager';
import StatisticsDashboard from './admin/StatisticsDashboard';
import { addPointsToAll, addTicketsToAll, adminGenerateLeaderboardBanners, adminGenerateTestLeaderboardBanners } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';

/*
// Компонент для массовых начислений (без изменений)
function MassActions() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [addPointsAmount, setAddPointsAmount] = useState(100);
  const [addTicketsAmount, setAddTicketsAmount] = useState(1);
  const [loading, setLoading] = useState(''); // 'points' or 'tickets'

  const handleAddPoints = async () => {
    const isConfirmed = await confirm(
      'Подтверждение',
      `Вы уверены, что хотите начислить ${addPointsAmount} спасибок всем пользователям?`
    );
    if (!isConfirmed) return;
    
    setLoading('points');
    try {
      const response = await addPointsToAll({ amount: parseInt(addPointsAmount, 10) });
      showAlert(response.data.detail, 'success');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось выполнить операцию';
      showAlert(errorMsg, 'error');
    } finally {
      setLoading('');
    }
  };
  
  const handleAddTickets = async () => {
    const isConfirmed = await confirm(
        'Подтверждение',
        `Вы уверены, что хотите начислить ${addTicketsAmount} билетов всем пользователям?`
    );
    if (!isConfirmed) return;

    setLoading('tickets');
    try {
      const response = await addTicketsToAll({ amount: parseInt(addTicketsAmount, 10) });
      showAlert(response.data.detail, 'success');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось выполнить операцию';
      showAlert(errorMsg, 'error');
    } finally {
      setLoading('');
    }
  };
  
  return (
    <>
      <div className={styles.card}>
        <h2>Начислить "спасибки" всем</h2>
        <input type="number" value={addPointsAmount} onChange={(e) => setAddPointsAmount(e.target.value)} className={styles.input} />
        <button onClick={handleAddPoints} disabled={loading} className={styles.buttonGreen}>
          {loading === 'points' ? 'Начисление...' : `Начислить ${addPointsAmount} спасибок`}
        </button>
      </div>
      <div className={styles.card}>
        <h2>Начислить билеты всем</h2>
        <input type="number" value={addTicketsAmount} onChange={(e) => setAddTicketsAmount(e.target.value)} className={styles.input} />
        <button onClick={handleAddTickets} disabled={loading} className={styles.buttonGreen}>
          {loading === 'tickets' ? 'Начисление...' : `Начислить ${addTicketsAmount} билетов`}
        </button>
      </div>
    </>
  );
}

*/

// --- ИСПРАВЛЕННЫЙ ГЛАВНЫЙ КОМПОНЕНТ ---
function AdminPage() {
  // Используем одну переменную для навигации. null - это главное меню.
  const [activeSection, setActiveSection] = useState(null);

// --- 1. ДОБАВЛЯЕМ ХУКИ И ЛОАДЕР ---
  // (Они у тебя уже импортированы, просто используем их)
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [loading, setLoading] = useState(false); // Для отслеживания загрузки

// Это твоя старая функция, она вызывает баннеры за ПРОШЛЫЙ МЕСЯЦ
  const handleGenerateBanners = async () => {
    const isConfirmed = await confirm(
        'Подтверждение (Прошлый месяц)',
        'Вы уверены? Будут созданы баннеры на основе данных ПРОШЛОГО месяца. Старые баннеры рейтинга удалятся.'
    );
    if (!isConfirmed) return;

    setLoading('monthly'); // Включаем лоадер для этой кнопки
    try {
        const response = await adminGenerateLeaderboardBanners();
        showAlert(response.data.detail || 'Баннеры (прошлый месяц) успешно сгенерированы!', 'success');
    } catch (error) {
        const errorMsg = error.response?.data?.detail || 'Не удалось выполнить операцию';
        showAlert(errorMsg, 'error');
    } finally {
        setLoading(null); // Выключаем лоадер
    }
  };

  const handleGenerateTestBanners = async () => {
    const isConfirmed = await confirm(
        'Подтверждение (Тест)',
        'Вы уверены? Будут созданы ТЕСТОВЫЕ баннеры на основе данных ТЕКУЩЕГО месяца. Старые баннеры рейтинга удалятся.'
    );
    if (!isConfirmed) return;

    setLoading('test'); // Включаем лоадер для этой кнопки
    try {
        const response = await adminGenerateTestLeaderboardBanners();
        showAlert(response.data.detail || 'Тестовые баннеры (текущий месяц) успешно сгенерированы!', 'success');
    } catch (error) {
        const errorMsg = error.response?.data?.detail || 'Не удалось выполнить операцию';
        showAlert(errorMsg, 'error');
    } finally {
        setLoading(null); // Выключаем лоадер
    }
  };
  
  const renderContent = () => {
    // Если секция не выбрана, показываем меню
    if (!activeSection) {
      return (
        <div className={styles.grid}>
          <button onClick={() => setActiveSection('stats')} className={styles.gridButton}>Статистика</button>
          <button onClick={() => setActiveSection('users')} className={styles.gridButton}>Пользователи</button>
          <button onClick={() => setActiveSection('items')} className={styles.gridButton}>Товары</button>
          <button onClick={() => setActiveSection('banners')} className={styles.gridButton}>Баннеры</button>
{/* --- 3. ВОТ ТВОЯ НОВАЯ КНОПКА --- */}
          <button 
            onClick={handleGenerateBanners} 
            disabled={loading !== null} 
            className={styles.gridButton}
          >
            {loading === 'monthly' ? 'Генерация...' : 'Создать Баннеры (Прошлый мес.)'}
          </button>

          {/* Новая кнопка (для текущего месяца) */}
          <button 
            onClick={handleGenerateTestBanners} 
            disabled={loading !== null} 
            className={styles.gridButton}
          >
            {loading === 'test' ? 'Генерация...' : 'Создать Баннеры (Текущий мес. / Тест)'}
          </button>
          {/*<button onClick={() => setActiveSection('mass-actions')} className={styles.gridButton}>Массовые начисления</button>*/}
        </div>
      );
    }
    
    // Если секция выбрана, показываем соответствующий компонент
    switch (activeSection) {
      case 'stats': return <StatisticsDashboard />;
      case 'banners': return <BannerManager />;
      case 'items': return <ItemManager />;
        {/*case 'mass-actions': return <MassActions />;*/}
      case 'users': return <UserManager />;
      default: return null; // На случай непредвиденного значения
    }
  };
  
  return (
    <PageLayout title="Админ-панель">
      {/* Кнопка "Назад" появляется, только если мы не в главном меню */}
      {activeSection && (
        <button onClick={() => setActiveSection(null)} className={styles.backButton}>
          &larr; Назад в меню
        </button>
      )}
      {renderContent()}
    </PageLayout>
  );
}

// Экспортируем компонент под правильным именем
export default AdminPage;
