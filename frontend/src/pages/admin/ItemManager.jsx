// frontend/src/pages/admin/ItemManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { clearCache } from '../../storage';
// Убедитесь, что здесь НЕТ импорта uploadItemImage
import { createMarketItem, getAllMarketItems, updateMarketItem, archiveMarketItem, getArchivedMarketItems, restoreMarketItem } from '../../api';
import styles from '../AdminPage.module.css';
import { FaArchive } from 'react-icons/fa';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

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
        showAlert('Не удалось загрузить товары.', 'error');
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchItems();
  }, []);
  
  const calculatedPrice = useMemo(() => {
      if (!form.price_rub || form.price_rub <= 0) return 0;
      return Math.round(form.price_rub / 50);
  }, [form.price_rub]);

  const forecast = useMemo(() => {
      if (!calculatedPrice || calculatedPrice <= 0) return "-";
      const monthsNeeded = calculatedPrice / 15;
      if (monthsNeeded <= 1) return "около 1 месяца";
      if (monthsNeeded <= 18) return `около ${Math.round(monthsNeeded)} мес.`;
      const years = (monthsNeeded / 12).toFixed(1);
      return `около ${years} лет`;
  }, [calculatedPrice]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Убедитесь, что здесь нет логики по загрузке файла (formData, append и т.д.)
    const { price, ...itemDataToSend } = {
      ...form,
      price_rub: parseInt(form.price_rub, 10),
      stock: parseInt(form.stock, 10),
    };

    try {
      if (editingItemId) {
        await updateMarketItem(editingItemId, itemDataToSend);
        showAlert('Товар успешно обновлен!', 'success');
      } else {
        await createMarketItem(itemDataToSend);
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

  const handleEdit = (item) => {
    setEditingItemId(item.id);
    setForm({
        name: item.name,
        description: item.description || '',
        price_rub: item.price_rub,
        stock: item.stock,
        image_url: item.image_url || ''
    });
    window.scrollTo(0, 0);
  };

  const resetForm = () => {
    setForm(initialItemState);
    setEditingItemId(null);
  };
  
  const handleArchive = async (itemId) => {
    const isConfirmed = await confirm('Архивация', 'Вы уверены, что хотите архивировать этот товар?');
    if (isConfirmed) {
        try {
            await archiveMarketItem(itemId);
            showAlert('Товар архивирован.', 'success');
            fetchItems();
            clearCache('market');
        } catch (error) {
            showAlert('Ошибка архивации.', 'error');
        }
    }
  };

  const handleRestore = async (itemId) => {
    const isConfirmed = await confirm('Восстановление', 'Вы уверены, что хотите восстановить этот товар?');
    if (isConfirmed) {
        try {
            await restoreMarketItem(itemId);
            showAlert('Товар восстановлен.', 'success');
            fetchItems();
            clearCache('market');
        } catch (error) {
            showAlert('Ошибка восстановления.', 'error');
        }
    }
  };

  return (
    <>
      <div className={styles.card}>
        <h2>{editingItemId ? 'Редактирование товара' : 'Создать новый товар'}</h2>
        <form onSubmit={handleFormSubmit}>
          
          {/* Вот новый блок, который должен появиться */}
          <div className={styles.imageUploader}>
            {form.image_url ? (
              <img 
                src={form.image_url} 
                alt="Предпросмотр" 
                className={styles.imagePreview} 
                onError={(e) => { e.target.style.display = 'none'; }} 
                onLoad={(e) => { e.target.style.display = 'block'; }}
              />
            ) : (
              <div className={styles.imagePlaceholder}>Фото</div>
            )}
          </div>
          <input 
            type="text" 
            name="image_url" 
            value={form.image_url} 
            onChange={handleFormChange} 
            placeholder="Прямая ссылка на изображение (URL)" 
            className={styles.input} 
          />
          {/* Старого блока с <input type="file"> здесь быть не должно */}
          
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
          <button type="submit" disabled={loading} className={styles.buttonGreen}>
            {editingItemId ? 'Сохранить' : 'Создать'}
          </button>
          {editingItemId && <button type="button" onClick={resetForm} className={styles.buttonGrey}>Отмена</button>}
        </form>
      </div>
      
      {/* Остальная часть компонента без изменений */}
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
