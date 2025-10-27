// frontend/src/components/CustomAlert.jsx

import React from 'react';
import styles from './CustomAlert.module.css';

function CustomAlert({ title, message, type, onClose }) {
  if (!message) return null;

  const typeClass = type === 'success' ? styles.success : styles.error;

  return (
    <div className={styles.backdrop}>
      <div className={`${styles.modal} ${typeClass}`}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <button onClick={onClose} className={styles.button}>
          ОК
        </button>
      </div>
    </div>
  );
}

export default CustomAlert;
