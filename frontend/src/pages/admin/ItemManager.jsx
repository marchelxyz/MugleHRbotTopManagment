// frontend/src/pages/admin/ItemManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { clearCache } from '../../storage'; 
import { createMarketItem, getAllMarketItems, updateMarketItem, archiveMarketItem, getArchivedMarketItems, restoreMarketItem, uploadItemImage } from '../../api';
import styles from '../AdminPage.module.css';
import { FaArchive } from 'react-icons/fa';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

// --- НАЧАЛО ИСПРАВЛЕНИЯ: Возвращаем недостающие функции ---
function calculateSpasibkiPrice(priceRub) {
    if (!priceRub || priceRub <= 0) return 0;
    return Math.round(priceRub / 50);
}

function calculateAccumulationForecast(priceSpasibki) {
    if (!priceSpasibki || priceSpasibki <= 0) return "-";
    const monthsNeeded = priceSpasibki / 15;
    if (monthsNeeded <= 1) return "около 1 месяца";
    if (monthsNeeded <= 18) return `около ${Math.round(monthsNeeded)} мес.`;
    const years = (monthsNeeded / 12).toFixed(1);
    return `около ${years} лет`;
}
// --- КОНЕЦ ИСПРАВЛЕНИЯ ---

const initialItemState = { name: '', description: '', price_rub: '', stock: 1, image_url: '' };

function ItemManager() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [view, setView] = useState('active');
  const [items, setItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [form, setForm] = useState(initialItemState);
  const [editingItemId, setEditingItemId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const [activeRes, archivedRes] = await Promise.all([
        getAllMarketItems(),
        getArchivedMarketItems()
      ]);
      setItems(activeRes.data);
      setArchivedItems(archivedRes.data);
    } catch (error) {
      showAlert('Ошибка загрузки списка товаров.', 'error');
    } finally {
      setLoading(false);
    }
  };
  
  const calculatedPrice = useMemo(() => calculateSpasibkiPrice(form.price_rub), [form.price_rub]);
  const forecast = useMemo(() => calculateAccumulationForecast(calculatedPrice), [calculatedPrice]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const response = await uploadItemImage(file);
      setForm(prev => ({ ...prev, image_url: response.data.url }));
    } catch (error) {
      showAlert('Ошибка загрузки изображения.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const itemData = {
      ...form,
      price_rub: parseInt(form.price_rub, 10),
      stock: parseInt(form.stock, 10),
    };
    try {
      if (editingItemId) {
        await updateMarketItem(editingItemId, itemData);
        showAlert('Товар успешно обновлен!', 'success');
      } else {
        await createMarketItem(itemData);
        showAlert('Товар успешно создан!', 'success');
      }
      resetForm();
      fetchItems();
      clearCache('market'); // 2. Очищаем кэш магазина!
    } catch (error) {
      showAlert('Произошла ошибка.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => {
    setEditingItemId(item.id);
    setForm({
      name: item.name,
      description: item.description,
      price_rub: item.price_rub,
      stock: item.stock,
      image_url: item.image_url || '',
    });
    window.scrollTo(0, 0);
  };

  const resetForm = () => {
    setForm(initialItemState);
    setEditingItemId(null);
  };

  const handleArchive = async (itemId) => {
    const isConfirmed = await confirm('Подтверждение', 'Вы уверены, что хотите архивировать этот товар?');
    if (isConfirmed) {
      await archiveMarketItem(itemId);
      showAlert('Товар архивирован.', 'success');
      fetchItems();
    }
  };

  const handleRestore = async (itemId) => {
    const isConfirmed = await confirm('Подтверждение', 'Вы уверены, что хотите восстановить этот товар?');
    if (isConfirmed) {
      await restoreMarketItem(itemId);
      showAlert('Товар восстановлен.', 'success');
      fetchItems();
    }
  };

  return (
    <>
      <div className={styles.card}>
        <h2>{editingItemId ? 'Редактирование товара' : 'Создать новый товар'}</h2>
        <form onSubmit={handleFormSubmit}>
          <div className={styles.imageUploader}>
            {/* --- 2. СТРОИМ ПОЛНУЮ ССЫЛКУ НА ИЗОБРАЖЕНИЕ --- */}
            {form.image_url ? (
              <img src={item.image_url}${form.image_url}`} alt="Предпросмотр" className={styles.imagePreview} />
            ) : (
              <div className={styles.imagePlaceholder}>300x300</div>
            )}
            <input type="file" id="imageUpload" onChange={handleImageUpload} accept="image/png, image/jpeg" style={{ display: 'none' }} />
            <label htmlFor="imageUpload" className={styles.buttonGrey}>
              {uploading ? 'Загрузка...' : 'Выбрать фото'}
            </label>
          </div>
          <input type="text" name="name" value={form.name} onChange={handleFormChange} placeholder="Название товара" className={styles.input} required />
          <textarea name="description" value={form.description} onChange={handleFormChange} placeholder="Описание товара" className={styles.textarea} />
          <input type="number" name="price_rub" value={form.price_rub} onChange={handleFormChange} placeholder="Цена в рублях" className={styles.input} required min="0" />
          
          {form.price_rub > 0 && (
            <div className={styles.pricePreview}>
              <p>Цена в спасибках: <strong>{calculatedPrice}</strong></p>
              <p>Прогноз накопления: <strong>{forecast}</strong></p>
            </div>
          )}
            
          <input type="number" name="stock" value={form.stock} onChange={handleFormChange} placeholder="Количество на складе" className={styles.input} required min="0" />
          <button type="submit" disabled={loading || uploading} className={styles.buttonGreen}>
            {editingItemId ? 'Сохранить' : 'Создать'}
          </button>
          {editingItemId && <button type="button" onClick={resetForm} className={styles.buttonGrey}>Отмена</button>}
        </form>
      </div>
      
      <div className={styles.tabs}>
        <button onClick={() => setView('active')} className={view === 'active' ? styles.tabActive : styles.tab}>Активные ({items.length})</button>
        <button onClick={() => setView('archived')} className={view === 'archived' ? styles.tabActive : styles.tab}>Архив ({archivedItems.length})</button>
      </div>

      <div className={styles.card}>
        <h2>{view === 'active' ? 'Активные товары' : 'Архив товаров'}</h2>
        <div className={styles.list}>
          {(view === 'active' ? items : archivedItems).map(item => (
            <div key={item.id} className={styles.listItem}>
              {item.image_url && <img src={item.image_url} alt={item.name} className={styles.listItemImage} />}
              <div className={styles.listItemContent}>
                <p><strong>{item.name}</strong></p>
                <p>Цена: {item.price} спасибок ({item.price_rub} ₽)</p>
                <p>Остаток: {item.stock} шт.</p>
              </div>
              <div className={styles.listItemActions}>
                {view === 'active' ? (
                  <>
                    <button onClick={() => handleEdit(item)} className={styles.buttonSmall}>✏️</button>
                    <button onClick={() => handleArchive(item.id)} className={styles.buttonSmallRed}>🗑️</button>
                  </>
                ) : (
                  <button onClick={() => handleRestore(item.id)} className={styles.buttonSmall}><FaArchive /> Восстановить</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default ItemManager;
