// frontend/src/components/LocalGiftModal.jsx

import React, { useState } from 'react';
import styles from './LocalGiftModal.module.css';

function LocalGiftModal({ isOpen, onClose, item, onConfirm }) {
  const [city, setCity] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (city.trim() && websiteUrl.trim()) {
      onConfirm(city.trim(), websiteUrl.trim());
      setCity('');
      setWebsiteUrl('');
    }
  };

  const handleClose = () => {
    setCity('');
    setWebsiteUrl('');
    onClose();
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Локальный подарок</h2>
          <button className={styles.closeButton} onClick={handleClose}>×</button>
        </div>
        
        <div className={styles.content}>
          <p className={styles.itemName}>{item.name}</p>
          <p className={styles.itemPrice}>Стоимость: {item.price} спасибок</p>
          
          <form onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="city">Город *</label>
              <input
                id="city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Введите город"
                required
                className={styles.input}
              />
            </div>
            
            <div className={styles.formGroup}>
              <label htmlFor="websiteUrl">Ссылка на сайт *</label>
              <input
                id="websiteUrl"
                type="url"
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://example.com"
                required
                className={styles.input}
              />
            </div>
            
            <div className={styles.buttons}>
              <button type="button" onClick={handleClose} className={styles.cancelButton}>
                Отмена
              </button>
              <button type="submit" className={styles.submitButton} disabled={!city.trim() || !websiteUrl.trim()}>
                Подтвердить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default LocalGiftModal;
