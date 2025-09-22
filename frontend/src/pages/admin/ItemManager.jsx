// frontend/src/pages/admin/ItemManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { clearCache } from '../../storage'; 
// 1. Убираем uploadItemImage из импортов
import { createMarketItem, getAllMarketItems, updateMarketItem, archiveMarketItem, getArchivedMarketItems, restoreMarketItem } from '../../api';
import styles from '../AdminPage.module.css';
import { FaArchive } from 'react-icons/fa';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

// ... (вспомогательные функции)

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
  // 2. Убираем состояние uploading

  useEffect(() => { fetchItems(); }, []);
  const fetchItems = async () => { /* ... */ };
  const calculatedPrice = useMemo(() => calculateSpasibkiPrice(form.price_rub), [form.price_rub]);
  const forecast = useMemo(() => calculateAccumulationForecast(calculatedPrice), [calculatedPrice]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  // 3. Удаляем всю функцию handleImageUpload

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Теперь image_url приходит напрямую из текстового поля
    const itemData = {
      ...form,
      price: calculateSpasibkiPrice(form.price_rub),
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
      clearCache('market');
    } catch (error) {
      showAlert('Произошла ошибка.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (item) => { /* ... */ };
  const resetForm = () => { /* ... */ };
  const handleArchive = async (itemId) => { /* ... */ };
  const handleRestore = async (itemId) => { /* ... */ };

  return (
    <>
      <div className={styles.card}>
        <h2>{editingItemId ? 'Редактирование товара' : 'Создать новый товар'}</h2>
        <form onSubmit={handleFormSubmit}>
          {/* 4. Заменяем загрузчик на простое текстовое поле */}
          <div className={styles.imageUploader}>
            {form.image_url ? (
              <img src={form.image_url} alt="Предпросмотр" className={styles.imagePreview} />
            ) : (
              <div className={styles.imagePlaceholder}>Фото</div>
            )}
          </div>
          <input 
            type="text" 
            name="image_url" 
            value={form.image_url} 
            onChange={handleFormChange} 
            placeholder="Прямая ссылка на изображение" 
            className={styles.input} 
          />
          
          <input type="text" name="name" value={form.name} onChange={handleFormChange} placeholder="Название товара" className={styles.input} required />
          <textarea name="description" value={form.description} onChange={handleFormChange} placeholder="Описание товара" className={styles.textarea} />
          <input type="number" name="price_rub" value={form.price_rub} onChange={handleFormChange} placeholder="Цена в рублях" className={styles.input} required min="0" />
          
          {form.price_rub > 0 && ( /* ... */ )}
            
          <input type="number" name="stock" value={form.stock} onChange={handleFormChange} placeholder="Количество на складе" className={styles.input} required min="0" />
          <button type="submit" disabled={loading} className={styles.buttonGreen}>
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
              {/* 3. Используем image_url НАПРЯМУЮ и здесь */}
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
