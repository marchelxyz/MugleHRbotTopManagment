import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getAdminMediaStatus, uploadAdminMedia } from '../api';
import styles from '../pages/AdminPage.module.css';

/**
 * Поле URL изображения с опциональной загрузкой в объектное хранилище (AVIF на сервере).
 */
function AdminImageUrlField({
  value,
  onChange,
  name = 'image_url',
  placeholder,
  urlHint,
}) {
  const [uploading, setUploading] = useState(false);
  const [storageReady, setStorageReady] = useState(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    getAdminMediaStatus()
      .then((res) => {
        if (!cancelled) setStorageReady(res.data.enabled);
      })
      .catch(() => {
        if (!cancelled) setStorageReady(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUrlChange = useCallback(
    (e) => {
      onChange(e.target.value);
    },
    [onChange],
  );

  const handlePickFile = () => {
    fileInputRef.current?.click();
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const response = await uploadAdminMedia(file);
      onChange(response.data.url);
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === 'string' ? detail : 'Ошибка загрузки');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div>
      <div className={styles.imageUploader}>
        {value ? (
          <img
            src={value}
            alt=""
            className={styles.imagePreview}
            onError={(ev) => {
              ev.target.style.display = 'none';
            }}
            onLoad={(ev) => {
              ev.target.style.display = 'block';
            }}
          />
        ) : (
          <div className={styles.imagePlaceholder}>Фото</div>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
        <input
          type="text"
          name={name}
          value={value}
          onChange={handleUrlChange}
          placeholder={placeholder}
          className={styles.input}
          style={{ flex: '1 1 200px', minWidth: 0 }}
        />
        {storageReady === true && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleFile}
            />
            <button
              type="button"
              className={styles.buttonGreen}
              onClick={handlePickFile}
              disabled={uploading}
            >
              {uploading ? 'Загрузка…' : 'Загрузить (AVIF)'}
            </button>
          </>
        )}
      </div>
      {storageReady === false && (
        <p className={styles.message} style={{ fontSize: '0.9em' }}>
          Загрузка в облако отключена: задайте переменные S3 в бэкенде или вставьте URL вручную.
        </p>
      )}
      {urlHint && <p className={styles.message} style={{ fontSize: '0.9em' }}>{urlHint}</p>}
      {error && <p className={styles.message}>{error}</p>}
    </div>
  );
}

export default AdminImageUrlField;
