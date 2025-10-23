// frontend/src/pages/admin/StatixSettings.jsx

import React, { useState, useEffect } from 'react';
import { FaCoins } from 'react-icons/fa';
import { getStatixBonusSettings, updateStatixBonusSettings } from '../../api';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { clearCache } from '../../storage';
import styles from '../AdminPage.module.css';

const StatixSettings = () => {
  const { showAlert } = useModalAlert();
  const [statixSettings, setStatixSettings] = useState({
    name: 'Бонусы Statix',
    description: 'Покупка бонусов для платформы Statix',
    image_url: '',
    thanks_to_statix_rate: 10,
    min_bonus_per_step: 100,
    max_bonus_per_step: 10000,
    bonus_step: 100
  });
  const [statixLoading, setStatixLoading] = useState(false);

  useEffect(() => {
    fetchStatixSettings();
  }, []);

  const fetchStatixSettings = async () => {
    setStatixLoading(true);
    try {
      const response = await getStatixBonusSettings();
      setStatixSettings(response.data);
    } catch (error) {
      showAlert('Не удалось загрузить настройки Statix Bonus.', 'error');
    } finally {
      setStatixLoading(false);
    }
  };

  const handleStatixSettingsChange = (e) => {
    const { name, value, type, checked } = e.target;
    setStatixSettings(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : (type === 'number' ? parseInt(value) || 0 : value)
    }));
  };

  const handleStatixSettingsSubmit = async (e) => {
    e.preventDefault();
    setStatixLoading(true);
    try {
      await updateStatixBonusSettings(statixSettings);
      showAlert('Настройки Statix Bonus обновлены!', 'success');
      clearCache('market');
    } catch (error) {
      showAlert('Ошибка при обновлении настроек.', 'error');
    } finally {
      setStatixLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2><FaCoins style={{marginRight: '8px'}} />Настройки Statix Bonus</h2>
      <form onSubmit={handleStatixSettingsSubmit}>
        <div className={styles.imageUploader}>
          {statixSettings.image_url ? (
            <img 
              src={statixSettings.image_url} 
              alt="Предпросмотр" 
              className={styles.imagePreview} 
              onError={(e) => { e.target.style.display = 'none'; }} 
              onLoad={(e) => { e.target.style.display = 'block'; }}
            />
          ) : (
            <div className={styles.imagePlaceholder}>Фото (4:3)</div>
          )}
        </div>
        <input 
          type="text" 
          name="image_url" 
          value={statixSettings.image_url} 
          onChange={handleStatixSettingsChange} 
          placeholder="Ссылка на изображение (URL) 4:3" 
          className={styles.input} 
        />
        
        <input 
          type="text" 
          name="name" 
          value={statixSettings.name} 
          onChange={handleStatixSettingsChange} 
          placeholder="Название товара" 
          className={styles.input} 
          required 
        />

        <textarea
          name="description"
          placeholder="Описание"
          value={statixSettings.description}
          onChange={handleStatixSettingsChange}
          maxLength="120"
          className={styles.textarea}
        />

        <div className={styles.statixSettingsGrid}>
          <div className={styles.settingGroup}>
            <label>Курс валют (спасибок за 100 бонусов)</label>
            <input 
              type="number" 
              name="thanks_to_statix_rate" 
              value={statixSettings.thanks_to_statix_rate} 
              onChange={handleStatixSettingsChange} 
              className={styles.input} 
              min="1"
              required 
            />
          </div>

          <div className={styles.settingGroup}>
            <label>Минимум бонусов за шаг</label>
            <input 
              type="number" 
              name="min_bonus_per_step" 
              value={statixSettings.min_bonus_per_step} 
              onChange={handleStatixSettingsChange} 
              className={styles.input} 
              min="1"
              required 
            />
          </div>

          <div className={styles.settingGroup}>
            <label>Максимум бонусов за шаг</label>
            <input 
              type="number" 
              name="max_bonus_per_step" 
              value={statixSettings.max_bonus_per_step} 
              onChange={handleStatixSettingsChange} 
              className={styles.input} 
              min="1"
              required 
            />
          </div>

          <div className={styles.settingGroup}>
            <label>Шаг увеличения бонусов</label>
            <input 
              type="number" 
              name="bonus_step" 
              value={statixSettings.bonus_step} 
              onChange={handleStatixSettingsChange} 
              className={styles.input} 
              min="1"
              required 
            />
          </div>
        </div>

        <div className={styles.pricePreview}>
          <p><strong>Примеры курса:</strong></p>
          <p>10 спасибок = 100 бонусов</p>
          <p>20 спасибок = 200 бонусов</p>
          <p>100 спасибок = 1000 бонусов</p>
          <p>1000 спасибок = 10000 бонусов</p>
        </div>

        <button type="submit" disabled={statixLoading} className={styles.buttonGreen}>
          {statixLoading ? 'Сохранение...' : 'Сохранить настройки'}
        </button>
      </form>
    </div>
  );
};

export default StatixSettings;