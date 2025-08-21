// frontend/src/pages/AdminPage.jsx

import React, { useState, useEffect } from 'react';
// --- ИЗМЕНЕНИЕ: Импортируем все нужные функции ---
import { 
  addPointsToAll, 
  createMarketItem,
  getAllBanners,
  createBanner,
  updateBanner,
  deleteBanner
} from '../api';
import styles from './AdminPage.module.css';

// Начальное состояние для формы баннера
const initialBannerState = {
  image_url: '',
  link_url: '',
  is_active: true,
  position: 'feed', // 'main' или 'feed'
};

function AdminPanel() {
  // Состояния для начисления баллов
  const [addPointsAmount, setAddPointsAmount] = useState(100);
  const [addPointsLoading, setAddPointsLoading] = useState(false);
  const [addPointsMessage, setAddPointsMessage] = useState('');

  // 2. Добавляем состояния для формы создания товара
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: 10,
    stock: 1,
  });
  const [createItemLoading, setCreateItemLoading] = useState(false);
  const [createItemMessage, setCreateItemMessage] = useState('');

  // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ БАННЕРОВ ---
  const [banners, setBanners] = useState([]);
  const [bannerForm, setBannerForm] = useState(initialBannerState);
  const [editingBannerId, setEditingBannerId] = useState(null); // ID баннера, который редактируется
  const [bannerLoading, setBannerLoading] = useState(false);
  const [bannerMessage, setBannerMessage] = useState('');

  // Загружаем список баннеров при первом рендере
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
  
  // Обработчик изменения полей формы баннера
  const handleBannerFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setBannerForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Обработчик отправки формы баннера (создание или обновление)
  const handleBannerSubmit = async (e) => {
    e.preventDefault();
    setBannerLoading(true);
    setBannerMessage('');
    try {
      if (editingBannerId) {
        // Обновляем существующий
        await updateBanner(editingBannerId, bannerForm);
        setBannerMessage('Баннер успешно обновлен!');
      } else {
        // Создаем новый
        await createBanner(bannerForm);
        setBannerMessage('Баннер успешно создан!');
      }
      // Сбрасываем форму и обновляем список
      setBannerForm(initialBannerState);
      setEditingBannerId(null);
      fetchBanners();
    } catch (error) {
      setBannerMessage('Произошла ошибка.');
    } finally {
      setBannerLoading(false);
    }
  };

  // Включение режима редактирования
  const handleEditBanner = (banner) => {
    setEditingBannerId(banner.id);
    // --- ИЗМЕНЕНИЕ: Устанавливаем position при редактировании ---
    setBannerForm({
      image_url: banner.image_url,
      link_url: banner.link_url || '',
      is_active: banner.is_active,
      position: banner.position || 'feed', // Устанавливаем позицию
    });
    window.scrollTo(0, document.body.scrollHeight); 
  };

  // Отмена редактирования
  const cancelEdit = () => {
    setEditingBannerId(null);
    setBannerForm(initialBannerState);
  };

  // Удаление баннера
  const handleDeleteBanner = async (bannerId) => {
    if (window.confirm('Вы уверены, что хотите удалить этот баннер?')) {
      try {
        await deleteBanner(bannerId);
        setBannerMessage('Баннер удален.');
        fetchBanners(); // Обновляем список
      } catch (error) {
        setBannerMessage('Ошибка при удалении.');
      }
    }
  };
  
  const handleAddPoints = async () => {
    if (!window.confirm(`Вы уверены, что хотите начислить ${addPointsAmount} баллов всем пользователям?`)) {
      return;
    }
    setAddPointsLoading(true);
    setAddPointsMessage('');
    try {
      const response = await addPointsToAll({ amount: parseInt(addPointsAmount, 10) });
      setAddPointsMessage(response.data.detail);
    } catch (error) {
      const errorDetails = error.response?.data?.detail || 'Не удалось выполнить операцию';
      const errorStatus = error.response?.status ? ` (Статус: ${error.response.status})` : '';
      setAddPointsMessage(`Ошибка: ${errorDetails}${errorStatus}`);
    } finally {
      setAddPointsLoading(false);
    }
  };

  // 3. Добавляем функцию для обработки создания товара
  const handleCreateItem = async (e) => {
    e.preventDefault();
    setCreateItemLoading(true);
    setCreateItemMessage('');
    try {
      const itemData = {
        ...newItem,
        price: parseInt(newItem.price, 10),
        stock: parseInt(newItem.stock, 10),
      };
      await createMarketItem(itemData);
      setCreateItemMessage(`Товар "${newItem.name}" успешно создан!`);
      // Очищаем форму
      setNewItem({ name: '', description: '', price: 10, stock: 1 });
    } catch (error) {
      const errorDetails = error.response?.data?.detail || 'Не удалось выполнить операцию';
      const errorStatus = error.response?.status ? ` (Статус: ${error.response.status})` : '';
      setCreateItemMessage(`Ошибка: ${errorDetails}${errorStatus}`);
    } finally {
      setCreateItemLoading(false);
    }
  };

  // 4. Функция для обновления полей формы
  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({ ...prev, [name]: value }));
  };

  return (
    <div className={styles.page}>
      <h1>⚙️ Админ-панель</h1>

      {/* --- НОВЫЙ РАЗДЕЛ: УПРАВЛЕНИЕ БАННЕРАМИ --- */}
      <div className={styles.card}>
        <h2>{editingBannerId ? 'Редактирование баннера' : 'Создать новый баннер'}</h2>
        <form onSubmit={handleBannerSubmit}>
          <input
            type="text"
            name="image_url"
            value={bannerForm.image_url}
            onChange={handleBannerFormChange}
            placeholder="URL картинки для баннера"
            className={styles.input}
            required
          />
          <input
            type="text"
            name="link_url"
            value={bannerForm.link_url}
            onChange={handleBannerFormChange}
            placeholder="URL для перехода (необязательно)"
            className={styles.input}
          />
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              name="is_active"
              checked={bannerForm.is_active}
              onChange={handleBannerFormChange}
            />
            Активен (показывать пользователям)
          </label>
          <button type="submit" disabled={bannerLoading} className={styles.buttonGreen}>
            {bannerLoading ? 'Сохранение...' : (editingBannerId ? 'Сохранить изменения' : 'Создать баннер')}
          </button>
          {editingBannerId && (
            <button type="button" onClick={cancelEdit} className={styles.buttonGrey}>
              Отмена
            </button>
          )}
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
                <p><b>Ссылка:</b> {banner.link_url || 'нет'}</p>
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
      
      {/* Карточка для начисления баллов (без изменений) */}
      <div className={styles.card}>
        <h2>Начислить баллы всем</h2>
        <p>Это действие добавит указанное количество баллов каждому зарегистрированному пользователю.</p>
        <input
          type="number"
          value={addPointsAmount}
          onChange={(e) => setAddPointsAmount(e.target.value)}
          className={styles.input}
        />
        <button onClick={handleAddPoints} disabled={addPointsLoading} className={styles.button}>
          {addPointsLoading ? 'Начисление...' : `Начислить ${addPointsAmount} баллов`}
        </button>
        {addPointsMessage && <p className={styles.message}>{addPointsMessage}</p>}
      </div>

      {/* 5. Новая карточка для создания товара */}
      <div className={styles.card}>
        <h2>Создать новый товар</h2>
        <form onSubmit={handleCreateItem}>
          <input
            type="text"
            name="name"
            value={newItem.name}
            onChange={handleItemChange}
            placeholder="Название товара"
            className={styles.input}
            required
          />
          <textarea
            name="description"
            value={newItem.description}
            onChange={handleItemChange}
            placeholder="Описание товара"
            className={styles.textarea}
          />
          <input
            type="number"
            name="price"
            value={newItem.price}
            onChange={handleItemChange}
            placeholder="Цена в баллах"
            className={styles.input}
            required
            min="0"
          />
          <input
            type="number"
            name="stock"
            value={newItem.stock}
            onChange={handleItemChange}
            placeholder="Количество на складе"
            className={styles.input}
            required
            min="0"
          />
          <button type="submit" disabled={createItemLoading} className={styles.buttonGreen}>
            {createItemLoading ? 'Создание...' : 'Создать товар'}
          </button>
          {createItemMessage && <p className={styles.message}>{createItemMessage}</p>}
        </form>
      </div>
    </div>
  );
}

export default AdminPanel;
