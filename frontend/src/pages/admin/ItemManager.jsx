// frontend/src/pages/admin/ItemManager.jsx

import React, { useState } from 'react';
import { FaCoins, FaPlus } from 'react-icons/fa';
import StatixSettings from './StatixSettings';
import ItemCreation from './ItemCreation';
import styles from './ItemManager.module.css';

const ItemManager = () => {
  const [activeTab, setActiveTab] = useState('statix');

  const tabs = [
    { id: 'statix', label: 'Настройки Statix Bonus', icon: <FaCoins /> },
    { id: 'creation', label: 'Создание нового товара', icon: <FaPlus /> },
  ];

  const renderActiveComponent = () => {
    switch (activeTab) {
      case 'statix': return <StatixSettings />;
      case 'creation': return <ItemCreation />;
      default: return <StatixSettings />;
    }
  };
  return (
    <div className={styles.itemManagerContainer}>
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
}

export default ItemManager;
