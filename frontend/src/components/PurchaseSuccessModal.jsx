// frontend/src/components/PurchaseSuccessModal.jsx

import React from 'react';
import styles from './PurchaseSuccessModal.module.css';
import { FaCheckCircle, FaTimes } from 'react-icons/fa';

function PurchaseSuccessModal({ item, onClose }) {
  // item содержит всю информацию о товаре, включая выданный код
  const { name, image_url, issued_code } = item;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose}>
          <FaTimes />
        </button>

        <div className={styles.iconContainer}>
          <FaCheckCircle className={styles.successIcon} />
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
            <div className={styles.codeValue}>{issued_code}</div>
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
