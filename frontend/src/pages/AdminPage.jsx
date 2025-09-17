import React, { useState } from 'react';
import styles from './AdminPage.module.css';
import PageLayout from '../components/PageLayout';
// Импортируем компоненты управления, которые мы сейчас создадим
import BannerManager from './admin/BannerManager'; 
import ItemManager from './admin/ItemManager';
import UserManager from './admin/UserManager';
import { addPointsToAll, addTicketsToAll } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext'; // 1. Импортируем

// Пока используем заглушки
const StatsManager = () => <div>Раздел статистики в разработке...</div>;

// --- ИЗМЕНЕНИЕ: Создаем новый компонент для массовых начислений ---
function MassActions() {
  const { showAlert } = useModalAlert(); // 2. Получаем функцию
  const [addPointsAmount, setAddPointsAmount] = useState(100);
  const [addTicketsAmount, setAddTicketsAmount] = useState(1);
  const [loading, setLoading] = useState(''); // 'points' or 'tickets'
  const [message, setMessage] = useState('');

  const handleAddPoints = async () => {
    if (!window.confirm(`Вы уверены?`)) return;
    setLoading('points');
    setMessage('');
    try {
      const response = await addPointsToAll({ amount: parseInt(addPointsAmount, 10) });
      showAlert(response.data.detail, 'success'); // 3. Используем новое уведомление
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось выполнить операцию';
      showAlert(errorMsg, 'error'); // 3. Используем новое уведомление
    } finally {
      setLoading('');
    }
  };
 
  const handleAddTickets = async () => {
    if (!window.confirm(`Вы уверены, что хотите начислить ${addTicketsAmount} билетов всем пользователям?`)) return;
    setLoading('tickets');
    try {
      const response = await addTicketsToAll({ amount: parseInt(addTicketsAmount, 10) });
      showAlert(response.data.detail, 'success'); // 3. Используем новое уведомление
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось выполнить операцию';
      showAlert(errorMsg, 'error'); // 3. Используем новое уведомление
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
  const [activeSection, setActiveSection] = useState(null);

  const renderSection = () => {
    switch (activeSection) {
      case 'banners': return <BannerManager />;
      case 'items': return <ItemManager />;
      case 'mass-actions': return <MassActions />; // Новый раздел
      case 'users': return <UserManager />;
      default:
        return (
          <div className={styles.grid}>
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
