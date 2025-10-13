// frontend/src/components/PurchaseSuccessModal.jsx

import React, { useState } from 'react'; // <-- 1. Импортируем useState
import Lottie from 'react-lottie-player';
import styles from './PurchaseSuccessModal.module.css';
// --- 2. Импортируем нужные иконки ---
import { FaTimes, FaCopy, FaCheck } from 'react-icons/fa'; 
import animationData from '../assets/AnimatedSticker4.json';

function PurchaseSuccessModal({ item, onClose }) {
  const { name, image_url, issued_code } = item;
  const [isCopied, setIsCopied] = useState(false); // <-- 3. Состояние для отслеживания копирования

  // --- 4. Функция для копирования кода ---
  const handleCopy = () => {
    navigator.clipboard.writeText(issued_code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000); // Возвращаем иконку обратно через 2 секунды
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          <FaTimes />
        </button>

        <div className={styles.iconContainer}>
          <Lottie
            animationData={animationData}
            loop={true}
            play={true}
            style={{ width: 120, height: 120, margin: '0 auto' }}
          />
        </div>

        <h2 className={styles.title}>Покупка совершена!</h2>
        <p className={styles.subtitle}>Вы успешно приобрели:</p>

        <div className={styles.itemCard}>
          {image_url ? (
            <img src={image_url} alt={name} className={styles.itemImage} />
          ) : (
            <div className={styles.imagePlaceholder}></div>
          )}
          <h3 className={styles.itemName}>{name}</h3>
        </div>

        {issued_code && (
          <div className={styles.codeSection}>
            <p className={styles.codeLabel}>Ваш уникальный код/ссылка:</p>
            
            {/* --- 5. НОВЫЙ БЛОК с кодом и кнопкой копирования --- */}
            <div className={styles.codeBox}>
              <span className={styles.codeValue}>{issued_code}</span>
              <button onClick={handleCopy} className={styles.copyButton}>
                {isCopied ? <FaCheck style={{ color: '#34c759' }} /> : <FaCopy />}
              </button>
            </div>

            <p className={styles.codeNote}>Код также отправлен в личные сообщения ботом.</p>
          </div>
        )}

        <button className={styles.confirmButton} onClick={onClose}>
          Отлично!
        </button>
      </div>
    </div>
  );
}

export default PurchaseSuccessModal;
