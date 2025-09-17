// frontend/src/pages/BonusCardPage.jsx

import React from 'react';
import Barcode from 'react-barcode';
import PageLayout from '../components/PageLayout';
import { deleteUserCard } from '../api';
import styles from './BonusCardPage.module.css';
import BonusCard from '../components/BonusCard';
import { useModalAlert } from '../contexts/ModalAlertContext'; // 1. Импортируем наш хук

function BonusCardPage({ user, onBack, onUpdateUser }) {
  const { showAlert } = useModalAlert(); // 2. Получаем функцию для вызова уведомлений
  
  const handleDelete = async () => {
    if (window.confirm('Вы уверены, что хотите удалить карту из профиля?')) {
      try {
        const response = await deleteUserCard();
        onUpdateUser(response.data); // Обновляем данные пользователя
        // 3. Вызываем наше красивое уведомление вместо alert()
        showAlert('Карта успешно удалена', 'success');
        onBack();
      } catch (error) {
        showAlert('Не удалось удалить карту', 'error');
      }
    }
  };
  
  return (
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
