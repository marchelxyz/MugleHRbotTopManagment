// frontend/src/pages/admin/BannerManager.jsx

import React, { useState, useEffect } from 'react';
import { getAllBanners, createBanner, updateBanner, deleteBanner } from '../../api';
import styles from '../AdminPage.module.css'; // Используем те же стили

const initialBannerState = {
  image_url: '',
  link_url: '',
  is_active: true,
  position: 'feed',
};

function BannerManager() {
  const [banners, setBanners] = useState([]);
  const [bannerForm, setBannerForm] = useState(initialBannerState);
  const [editingBannerId, setEditingBannerId] = useState(null);
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

  useEffect(() => {
    fetchBanners();
  }, []);

  const fetchBanners = async () => {
    try {
      const response = await getAllBanners();
      setBanners(response.data);
    } catch (error) {
      setBannerMessage('Ошибка при загрузке баннеров.');
    }
  };
  
  const handleBannerFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBannerForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleBannerSubmit = async (e) => {
    e.preventDefault();
    setBannerLoading(true);
    setBannerMessage('');
    try {
      if (editingBannerId) {
        await updateBanner(editingBannerId, bannerForm);
        setBannerMessage('Баннер успешно обновлен!');
      } else {
        await createBanner(bannerForm);
        setBannerMessage('Баннер успешно создан!');
      }
      setBannerForm(initialBannerState);
      setEditingBannerId(null);
      fetchBanners();
    } catch (error) {
      setBannerMessage('Произошла ошибка.');
    } finally {
      setBannerLoading(false);
    }
  };

  const handleEditBanner = (banner) => {
    setEditingBannerId(banner.id);
    setBannerForm({
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      is_active: banner.is_active,
      position: banner.position || 'feed',
    });
  };

  const cancelEdit = () => {
    setEditingBannerId(null);
    setBannerForm(initialBannerState);
  };

  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот баннер?')) {
      try {
        await deleteBanner(bannerId);
        setBannerMessage('Баннер удален.');
        fetchBanners();
      } catch (error) {
        setBannerMessage('Ошибка при удалении.');
      }
    }
  };

  return (
    <>
      <div className={styles.card}>
        <h2>{editingBannerId ? 'Редактирование баннера' : 'Создать новый баннер'}</h2>
        <form onSubmit={handleBannerSubmit}>
          <input type="text" name="image_url" value={bannerForm.image_url} onChange={handleBannerFormChange} placeholder="URL картинки для баннера" className={styles.input} required />
          <input type="text" name="link_url" value={bannerForm.link_url} onChange={handleBannerFormChange} placeholder="URL для перехода (необязательно)" className={styles.input} />
          <select name="position" value={bannerForm.position} onChange={handleBannerFormChange} className={styles.input}>
            <option value="feed">Баннер в ленте (горизонтальный)</option>
            <option value="main">Главный баннер (верхний)</option>
          </select>
          <label className={styles.checkboxLabel}>
            <input type="checkbox" name="is_active" checked={bannerForm.is_active} onChange={handleBannerFormChange} />
            Активен (показывать пользователям)
          </label>
          <button type="submit" disabled={bannerLoading} className={styles.buttonGreen}>
            {bannerLoading ? 'Сохранение...' : (editingBannerId ? 'Сохранить изменения' : 'Создать баннер')}
          </button>
          {editingBannerId && (<button type="button" onClick={cancelEdit} className={styles.buttonGrey}>Отмена</button>)}
          {bannerMessage && <p className={styles.message}>{bannerMessage}</p>}
        </form>
      </div>
      <div className={styles.card}>
        <h2>Список существующих баннеров</h2>
        <div className={styles.list}>
          {banners.map(banner => (
            <div key={banner.id} className={styles.listItem}>
              <img src={banner.image_url} alt="banner" className={styles.listItemImage} />
              <div className={styles.listItemContent}>
                <p><b>Позиция:</b> {banner.position === 'main' ? 'Главный' : 'В ленте'}</p>
                <p><b>Статус:</b> {banner.is_active ? '✅ Активен' : '❌ Скрыт'}</p>
              </div>
              <div className={styles.listItemActions}>
                <button onClick={() => handleEditBanner(banner)} className={styles.buttonSmall}>✏️</button>
                <button onClick={() => handleDeleteBanner(banner.id)} className={styles.buttonSmallRed}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default BannerManager;
