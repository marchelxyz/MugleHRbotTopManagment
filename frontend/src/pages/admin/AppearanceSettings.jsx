import React, { useEffect, useState } from 'react';
import styles from '../AdminPage.module.css';
import { getAppSettings, updateAppSettings } from '../../api';
import { useModalAlert } from '../../contexts/ModalAlertContext';

const AppearanceSettings = ({ seasonTheme: initialTheme, onThemeUpdated }) => {
  const { showAlert } = useModalAlert();
  const [seasonTheme, setSeasonTheme] = useState(initialTheme || 'summer');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeasonTheme(initialTheme || 'summer');
  }, [initialTheme]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await getAppSettings();
        if (response?.data?.season_theme) {
          setSeasonTheme(response.data.season_theme);
        }
      } catch (error) {
        showAlert('Не удалось загрузить настройки оформления.', 'error');
      }
    };

    fetchSettings();
  }, [showAlert]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await updateAppSettings({ season_theme: seasonTheme });
      showAlert('Оформление обновлено.', 'success');
      if (response?.data?.season_theme) {
        onThemeUpdated?.(response.data.season_theme);
      } else {
        onThemeUpdated?.(seasonTheme);
      }
    } catch (error) {
      showAlert('Не удалось сохранить оформление.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2>Оформление</h2>
      <label className={styles.checkboxLabel}>
        <input
          type="checkbox"
          checked={seasonTheme === 'winter'}
          onChange={(event) => setSeasonTheme(event.target.checked ? 'winter' : 'summer')}
        />
        Включить зимнее оформление (гирлянда и цвета)
      </label>
      <button onClick={handleSave} disabled={loading} className={styles.buttonGreen}>
        {loading ? 'Сохранение...' : 'Сохранить оформление'}
      </button>
    </div>
  );
};

export default AppearanceSettings;
