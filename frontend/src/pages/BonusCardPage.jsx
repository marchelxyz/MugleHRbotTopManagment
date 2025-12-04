// frontend/src/pages/BonusCardPage.jsx

import React from 'react';
import Barcode from 'react-barcode';
import PageLayout from '../components/PageLayout';
import { deleteUserCard } from '../api';
import styles from './BonusCardPage.module.css';
import BonusCard from '../components/BonusCard';
import { useModalAlert } from '../contexts/ModalAlertContext'; // 1. Импортируем наш хук
import { useConfirmation } from '../contexts/ConfirmationContext'; // 1. Импортируем

function BonusCardPage({ user, onBack, onUpdateUser }) {
  const { confirm } = useConfirmation(); // 2. Получаем функцию
  const { showAlert } = useModalAlert(); // 2. Получаем функцию для вызова уведомлений
  
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
    if (window.Telegram?.WebApp?.openLink && typeof window.Telegram.WebApp.openLink === 'function') {
      try {
        window.Telegram.WebApp.openLink(url);
      } catch (error) {
        console.warn('Ошибка при открытии ссылки через Telegram Web App:', error);
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <PageLayout title="Бонусная карта">
      <button onClick={onBack} className={styles.backButton}>&larr; Назад в профиль</button>

      {user.card_barcode ? (
        <div className={styles.cardContainer}>
          {/* --- ИЗМЕНЕНИЕ: Используем новый компонент BonusCard --- */}
          <BonusCard user={user} />
          <button onClick={handleDelete} className={styles.deleteButton}>Удалить карту</button>
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
