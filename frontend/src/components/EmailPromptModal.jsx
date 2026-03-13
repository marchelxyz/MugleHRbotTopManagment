// frontend/src/components/EmailPromptModal.jsx

import React, { useState } from 'react';
import styles from './EmailPromptModal.module.css';

/**
 * Модальное окно с просьбой указать email при входе в веб-версию.
 */
function EmailPromptModal({ onSave, onLater, initialEmail = '' }) {
  const [email, setEmail] = useState(initialEmail || '');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (val) => {
    if (!val.trim()) return 'Укажите адрес электронной почты';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(val.trim())) return 'Введите корректный email';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validateEmail(email);
    if (err) {
      setError(err);
      return;
    }
    setError('');
    setLoading(true);
    try {
      await onSave(email.trim());
    } catch (err) {
      setError(err.response?.data?.detail || 'Не удалось сохранить. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onLater}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Укажите электронную почту</h2>
        <p className={styles.text}>
          Пожалуйста, укажите ваш email. Он будет использоваться для уведомлений о покупках и связи со службой поддержки.
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(''); }}
            placeholder="example@company.ru"
            className={styles.input}
            autoComplete="email"
            autoFocus
          />
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.buttons}>
            <button type="submit" disabled={loading} className={styles.submitBtn}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={onLater} className={styles.laterBtn}>
              Напомнить позже
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EmailPromptModal;
