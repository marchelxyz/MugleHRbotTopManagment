// frontend/src/pages/BonusCardPage.jsx

import React, { useState } from 'react';
import Barcode from 'react-barcode';
import PageLayout from '../components/PageLayout';
import { deleteUserCard, refreshCardBalance } from '../api';
import styles from './BonusCardPage.module.css';
import BonusCard from '../components/BonusCard';
import { useModalAlert } from '../contexts/ModalAlertContext'; // 1. Импортируем наш хук
import { useConfirmation } from '../contexts/ConfirmationContext'; // 1. Импортируем

function BonusCardPage({ user, onBack, onUpdateUser }) {
  const { confirm } = useConfirmation(); // 2. Получаем функцию
  const { showAlert } = useModalAlert(); // 2. Получаем функцию для вызова уведомлений
  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);
  
  // Ссылка на аккаунт поддержки в Telegram (такой же, как в настройках)
  const supportUrl = 'https://t.me/fix2Form';
  
  const handleDelete = async () => {
    const isConfirmed = await confirm(
      'Удаление карты',
      'Вы уверены, что хотите удалить карту из профиля?'
    );
    if (isConfirmed) {
      try {
        const response = await deleteUserCard();
        onUpdateUser(response.data);
        showAlert('Карта успешно удалена.', 'success');
        onBack();
      } catch (error) {
        showAlert('Не удалось удалить карту.', 'error');
      }
    }
  };

  const handleRequestCard = () => {
    // Формируем сообщение с данными пользователя
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Не указано';
    const phoneNumber = user.phone_number || 'Не указан';
    
    const message = `Здравствуйте! Мне нужна карта Statix. Мои данные для выдачи:\n1. Имя Фамилия - ${userName}\n2. Номер телефона - ${phoneNumber}`;
    
    // Кодируем сообщение для URL
    const encodedMessage = encodeURIComponent(message);
    
    // Формируем URL с предзаполненным сообщением
    const url = `${supportUrl}?text=${encodedMessage}`;
    
    // Используем Telegram Web App API, если доступен, иначе обычный window.open
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleRefreshBalance = async () => {
    setIsRefreshingBalance(true);
    try {
      const response = await refreshCardBalance();
      onUpdateUser(response.data);
      showAlert('Баланс карты обновлен!', 'success');
    } catch (error) {
      showAlert(
        error.response?.data?.detail || 'Не удалось обновить баланс карты. Попробуйте позже.',
        'error'
      );
    } finally {
      setIsRefreshingBalance(false);
    }
  };

  return (
    <PageLayout title="Бонусная карта">
      <button onClick={onBack} className={styles.backButton}>&larr; Назад в профиль</button>

      {user.card_barcode ? (
        <div className={styles.cardContainer}>
          {/* --- ИЗМЕНЕНИЕ: Используем новый компонент BonusCard --- */}
          <BonusCard user={user} />
          <div className={styles.buttonGroup}>
            <button 
              onClick={handleRefreshBalance} 
              className={styles.refreshButton}
              disabled={isRefreshingBalance}
            >
              {isRefreshingBalance ? 'Обновление...' : '🔄 Обновить баланс'}
            </button>
            <button onClick={handleDelete} className={styles.deleteButton}>Удалить карту</button>
          </div>
        </div>
      ) : (
        <div className={styles.cardContainer}>
          <p className={styles.infoText}>У вас пока нет бонусной карты.</p>
          <p className={styles.subText}>Чтобы добавить карту, отправьте файл `.pkpass` нашему боту в Telegram.</p>
          <button onClick={handleRequestCard} className={styles.requestButton}>
            Запросить карту
          </button>
        </div>
      )}
    </PageLayout>
  );
}

export default BonusCardPage;
