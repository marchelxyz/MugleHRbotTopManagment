// frontend/src/pages/ProfilePage.jsx

import React, { useEffect } from 'react'; // --- ИСПРАВЛЕНИЕ: Добавляем импорт useEffect ---
import styles from './ProfilePage.module.css';
import { FaCog, FaCreditCard, FaPencilAlt } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import { formatDateForDisplay } from '../utils/dateFormatter';

function ProfilePage({ user, telegramPhotoUrl, onNavigate }) {

const displayDateOfBirth = formatDateForDisplay(user.date_of_birth);
  
  return (
    <PageLayout title="Профиль">
      <div className={styles.settingsIconContainer}>
        <button onClick={() => onNavigate('settings')} className={styles.settingsButton}>
          <FaCog size={22} />
        </button>
      </div>

      <div className={styles.profileHeader}>
        {telegramPhotoUrl && <img src={telegramPhotoUrl} alt="User" className={styles.profilePhoto} />}
        {/* --- 2. ОБОРАЧИВАЕМ ИМЯ И КНОПКУ В КОНТЕЙНЕР --- */}
        <div className={styles.profileNameContainer}> 
            <div className={styles.profileName}>{user.first_name} {user.last_name}</div>
            {/* --- 3. ДОБАВЛЯЕМ КНОПКУ (КАРАНДАШ) --- */}
            <button onClick={() => onNavigate('edit_profile')} className={styles.editButton}>
                <FaPencilAlt size={16} />
            </button>
        </div>

        <div className={styles.profilePosition}>{user.position}</div>
      </div>

      <div className={styles.card}>
        <p className={styles.infoItem}>
          <span className={styles.label}>Подразделение:</span>
          {user.department}
        </p>
        <p className={styles.infoItem}>
          <span className={styles.label}>Телефон:</span>
          {user.phone_number || 'Не указан'}
        </p>
          <div className={styles.infoItem}>
            <span className={styles.label}>Дата рождения</span>
            {/* 3. ВЫВОДИМ ОТФОРМАТИРОВАННУЮ ДАТУ */}
            <span className={styles.value}>{displayDateOfBirth || 'Не указана'}</span>
          </div>
        </div>
        <p className={styles.infoItem}>
            <span className={styles.label}>Накоплено:</span>
            {user.balance} спасибок
        </p>
         {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
        <p className={styles.infoItem}><span className={styles.label}>Билеты для рулетки:</span> {user.tickets} шт.</p>
        <p className={styles.infoItem}><span className={styles.label}>Части билетов:</span> {user.ticket_parts} / 2</p>
        {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
      </div>

       {/* --- НАЧАЛО ИЗМЕНЕНИЙ --- */}
      <div className={styles.actionsGrid}>
        <button onClick={() => onNavigate('history')} className={styles.actionButton}>История транзакций</button>
        {/* Новая кнопка, которая ведет на страницу карты */}
        <button onClick={() => onNavigate('bonus_card')} className={styles.actionButton}>
          <FaCreditCard style={{ marginRight: '8px' }} />
          Бонусная карта
        </button>
      </div>
      {/* --- КОНЕЦ ИЗМЕНЕНИЙ --- */}
    </PageLayout>
  );
}
export default ProfilePage;
