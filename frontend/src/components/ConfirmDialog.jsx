// frontend/src/components/ConfirmDialog.jsx
import React from 'react';
import styles from './ConfirmDialog.module.css';

function ConfirmDialog({ title, message, onConfirm, onCancel }) {
  // --- НАШ "ЖУЧОК" ---
  // Эта строка поможет нам понять, пытается ли React нарисовать это окно.
  
  return (
    <div className={styles.backdrop}>
      <div className={styles.modal}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        <div className={styles.buttonGroup}>
          <button onClick={onCancel} className={`${styles.button} ${styles.cancelButton}`}>
            Отмена
          </button>
          <button onClick={onConfirm} className={`${styles.button} ${styles.confirmButton}`}>
            Да, уверен
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDialog;
