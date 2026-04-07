import React, { useEffect, useState, useCallback } from 'react';
import styles from '../AdminPage.module.css';
import { getAppSettings, updateAppSettings } from '../../api';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import AdminImageUrlField from '../../components/AdminImageUrlField';
import { THEME_ASSET_DEFAULTS } from '../../themeAssetDefaults';

const ASSET_FIELDS = [
  { key: 'header_image_mobile', label: 'Шапка главной (мобильная)' },
  { key: 'header_image_desktop', label: 'Шапка главной (ПК)' },
  { key: 'section_header_image', label: 'Полоса в заголовке страниц (разделы)' },
  { key: 'sidenav_logo', label: 'Логотип в боковом меню' },
  { key: 'thanks_button', label: 'Кнопка «Отправить спасибки»' },
  { key: 'thanks_feed_logo', label: 'Логотип «спасибо» в ленте' },
  { key: 'leaderboard_thanks_logo', label: 'Иконка «спасибо» в рейтинге' },
];

function mergeWithDefaults(loaded) {
  return {
    summer: { ...THEME_ASSET_DEFAULTS.summer, ...(loaded?.summer || {}) },
    winter: { ...THEME_ASSET_DEFAULTS.winter, ...(loaded?.winter || {}) },
  };
}

function stripEmptyUrls(seasonObj) {
  if (!seasonObj) return {};
  const out = {};
  for (const [k, v] of Object.entries(seasonObj)) {
    if (v != null && String(v).trim()) {
      out[k] = String(v).trim();
    }
  }
  return out;
}

const AppearanceSettings = ({ seasonTheme: initialTheme, themeAssets: initialAssets, onAppearanceUpdated }) => {
  const { showAlert } = useModalAlert();
  const [seasonTheme, setSeasonTheme] = useState(initialTheme || 'summer');
  const [assets, setAssets] = useState(() => mergeWithDefaults(initialAssets));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setSeasonTheme(initialTheme || 'summer');
  }, [initialTheme]);

  useEffect(() => {
    setAssets(mergeWithDefaults(initialAssets));
  }, [initialAssets]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await getAppSettings();
        if (cancelled) return;
        if (response?.data?.season_theme) {
          setSeasonTheme(response.data.season_theme);
        }
        setAssets(mergeWithDefaults(response?.data?.theme_assets));
      } catch (error) {
        if (!cancelled) {
          showAlert('Не удалось загрузить настройки оформления.', 'error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAlert]);

  const setSeasonField = useCallback((season, key, value) => {
    setAssets((prev) => ({
      ...prev,
      [season]: { ...prev[season], [key]: value },
    }));
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      const response = await updateAppSettings({
        season_theme: seasonTheme,
        theme_assets: {
          summer: stripEmptyUrls(assets.summer),
          winter: stripEmptyUrls(assets.winter),
        },
      });
      showAlert('Оформление обновлено.', 'success');
      if (response?.data) {
        onAppearanceUpdated?.(response.data);
      }
    } catch (error) {
      showAlert('Не удалось сохранить оформление.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const renderSeasonBlock = (season, title) => (
    <div key={season} style={{ marginTop: '1rem' }}>
      <h3 style={{ marginBottom: '0.75rem' }}>{title}</h3>
      {ASSET_FIELDS.map(({ key, label }) => (
        <div key={key} style={{ marginBottom: '1rem' }}>
          <p style={{ margin: '0 0 0.35rem', fontWeight: 600 }}>{label}</p>
          <AdminImageUrlField
            value={assets[season]?.[key] || ''}
            onChange={(v) => setSeasonField(season, key, v)}
            placeholder="URL или загрузка AVIF в объектное хранилище"
          />
        </div>
      ))}
    </div>
  );

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
      <p style={{ fontSize: '0.9rem', opacity: 0.85 }}>
        Картинки ниже подставляются для летней и зимней темы. Пустые поля — встроенные картинки по умолчанию.
        Загрузка конвертирует файл в AVIF и сохраняет в S3 (если настроено).
      </p>
      {renderSeasonBlock('summer', 'Лето')}
      {renderSeasonBlock('winter', 'Зима')}
      <button type="button" onClick={handleSave} disabled={loading} className={styles.buttonGreen} style={{ marginTop: '1rem' }}>
        {loading ? 'Сохранение...' : 'Сохранить оформление'}
      </button>
    </div>
  );
};

export default AppearanceSettings;
