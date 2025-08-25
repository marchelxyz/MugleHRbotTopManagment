import React, { useState } from 'react';
import styles from './AdminPage.module.css';
import PageLayout from '../components/PageLayout';
// Импортируем компоненты управления, которые мы сейчас создадим
import BannerManager from './admin/BannerManager'; 
import ItemManager from './admin/ItemManager';

// Пока используем заглушки
const UserManager = () => <div>Раздел управления пользователями в разработке...</div>;
const StatsManager = () => <div>Раздел статистики в разработке...</div>;

function AdminPanel() {
  const [activeSection, setActiveSection] = useState(null);

  const renderSection = () => {
    switch (activeSection) {
      case 'banners':
        return <BannerManager />;
      case 'items':
        return <ItemManager />;
      case 'users':
        return <UserManager />;
      case 'stats':
        return <StatsManager />;
      default:
        return (
          <div className={styles.grid}>
            <button onClick={() => setActiveSection('banners')} className={styles.gridButton}>Баннеры</button>
            <button onClick={() => setActiveSection('users')} className={styles.gridButton}>Пользователи</button>
            <button onClick={() => setActiveSection('stats')} className={styles.gridButton}>Статистика</button>
            <button onClick={() => setActiveSection('items')} className={styles.gridButton}>Товары</button>
          </div>
        );
    }
  };

  return (
    <PageLayout title="⚙️ Админ-панель">
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
