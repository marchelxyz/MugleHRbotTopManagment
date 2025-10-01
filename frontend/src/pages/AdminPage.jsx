import React, { useState } from 'react';
import styles from './AdminPage.module.css';
import PageLayout from '../components/PageLayout';
// Импортируем компоненты управления, которые мы сейчас создадим
import BannerManager from './admin/BannerManager'; 
import ItemManager from './admin/ItemManager';
import UserManager from './admin/UserManager';
import StatisticsDashboard from './admin/StatisticsDashboard';
import { addPointsToAll, addTicketsToAll } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext'; // 1. Импортируем
import { useConfirmation } from '../contexts/ConfirmationContext'; // 1. Импортируем

// Пока используем заглушки
const StatsManager = () => <div>Раздел статистики в разработке...</div>;

// --- ИЗМЕНЕНИЕ: Создаем новый компонент для массовых начислений ---
function MassActions() {
  const { showAlert } = useModalAlert(); // 2. Получаем функцию
  const { confirm } = useConfirmation(); // 2. Получаем функцию подтверждения
  const [addPointsAmount, setAddPointsAmount] = useState(100);
  const [addTicketsAmount, setAddTicketsAmount] = useState(1);
  const [loading, setLoading] = useState(''); // 'points' or 'tickets'
  const [message, setMessage] = useState('');

  const handleAddPoints = async () => {
    // 3. Заменяем window.confirm на нашу новую асинхронную функцию
    const isConfirmed = await confirm(
      'Подтверждение', 
      `Вы уверены, что хотите начислить ${addPointsAmount} спасибок всем пользователям?`
    );
    if (!isConfirmed) return; // Если пользователь нажал "Отмена", выходим
    
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
      {message && <p className={styles.message}>{message}</p>}
    </>
  );
}

// --- ИЗМЕНЕНИЕ: Обновляем главный компонент ---
function AdminPanel() {
  const [activeTab, setActiveTab] = useState('stats');
  const [activeSection, setActiveSection] = useState(null);

  const renderSection = () => {
    switch (activeSection) {
      case 'stats': return <StatisticsDashboard />;
      case 'banners': return <BannerManager />;
      case 'items': return <ItemManager />;
      case 'mass-actions': return <MassActions />; // Новый раздел
      case 'users': return <UserManager />;
      default:
        return <StatisticsDashboard />;
    }
  };
  
  return (
          <div className={styles.grid}>
            <button onClick={() => setActiveTab('stats')} className={activeTab === 'stats' ? styles.tabActive : styles.tab}>Статистика</button>
            <button onClick={() => setActiveSection('banners')} className={styles.gridButton}>Баннеры</button>
            <button onClick={() => setActiveSection('items')} className={styles.gridButton}>Товары</button>
            <button onClick={() => setActiveSection('mass-actions')} className={styles.gridButton}>Массовые начисления</button>
            <button onClick={() => setActiveSection('users')} className={styles.gridButton}>Пользователи</button>
          </div>
        );
    }
  };

  return (
    <PageLayout title="Админ">
      {activeSection && (
        <button onClick={() => setActiveSection(null)} className={styles.backButton}>
          &larr; Назад в меню
        </button>
      )}
      {renderSection()}
    </PageLayout>
  );
}

export default AdminPanel;
