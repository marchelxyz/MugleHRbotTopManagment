import React, { useState, useRef } from 'react';
import PageLayout from '../components/PageLayout';
import { deleteUserCard, uploadPkpassFile } from '../api';
import styles from './BonusCardPage.module.css';
import BonusCard from '../components/BonusCard';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { FaUpload, FaSpinner } from 'react-icons/fa';

function BonusCardPage({ user, onBack, onUpdateUser }) {
  const { confirm } = useConfirmation();
  const { showAlert } = useModalAlert();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  const isTelegramWebApp = !!window.Telegram?.WebApp;
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
    const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'Не указано';
    const phoneNumber = user.phone_number || 'Не указан';
    
    const message = `Здравствуйте! Мне нужна карта Statix. Мои данные для выдачи:\n1. Имя Фамилия - ${userName}\n2. Номер телефона - ${phoneNumber}`;
    const encodedMessage = encodeURIComponent(message);
    const url = `${supportUrl}?text=${encodedMessage}`;
    
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.pkpass')) {
      showAlert('Допускается только файл формата .pkpass', 'error');
      return;
    }

    setUploading(true);
    try {
      const response = await uploadPkpassFile(file);
      onUpdateUser(response.data);
      showAlert('Бонусная карта успешно добавлена!', 'success');
    } catch (error) {
      const msg = error.response?.data?.detail || 'Ошибка при загрузке файла';
      showAlert(msg, 'error');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <PageLayout title="Бонусная карта">
      <button onClick={onBack} className={styles.backButton}>&larr; Назад в профиль</button>

      {user.card_barcode ? (
        <div className={styles.cardContainer}>
          <BonusCard user={user} />
          <button onClick={handleDelete} className={styles.deleteButton}>Удалить карту</button>
        </div>
      ) : (
        <div className={styles.cardContainer}>
          <p className={styles.infoText}>У вас пока нет бонусной карты.</p>

          <p className={styles.subText}>
            {isTelegramWebApp
              ? <>Чтобы добавить карту, отправьте файл <code>.pkpass</code> нашему боту в Telegram.</>
              : <>Загрузите файл <code>.pkpass</code> с вашей бонусной картой или запросите её у поддержки.</>}
          </p>

          <button onClick={handleRequestCard} className={styles.requestButton}>
            Запросить карту
          </button>

          {!isTelegramWebApp && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pkpass"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className={styles.uploadButton}
                disabled={uploading}
              >
                {uploading ? (
                  <><FaSpinner className={styles.spinIcon} style={{ marginRight: '8px' }} /> Загрузка...</>
                ) : (
                  <><FaUpload style={{ marginRight: '8px' }} /> Загрузить .pkpass</>
                )}
              </button>
            </>
          )}
        </div>
      )}
    </PageLayout>
  );
}

export default BonusCardPage;
