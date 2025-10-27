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
        </div>
      )}
    </PageLayout>
  );
}

export default BonusCardPage;
