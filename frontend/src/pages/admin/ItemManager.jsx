// frontend/src/pages/admin/ItemManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { clearCache } from '../../storage';
// --- 1. ИМПОРТИРУЕМ НОВУЮ ФУНКЦИЮ ---
import { createMarketItem, getAllMarketItems, updateMarketItem, archiveMarketItem, getArchivedMarketItems, restoreMarketItem, deleteMarketItemPermanently } from '../../api';
import styles from '../AdminPage.module.css';
// --- 2. ИМПОРТИРУЕМ НОВЫЕ ИКОНКИ ---
import { FaArchive, FaTrash } from 'react-icons/fa';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

// --- 3. РАСШИРЯЕМ НАЧАЛЬНОЕ СОСТОЯНИЕ ФОРМЫ ---
const initialItemState = {
  name: '',
  description: '',
  price_rub: '',
  original_price_rub: '',
  stock: 1,
  image_url: '',
  is_auto_issuance: false,
  codes_text: '',
  added_stock: '', // Для пополнения обычных товаров
  new_item_codes: '' // Для пополнения кодов
};

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
      return Math.round(form.price_rub / 30);
  }, [form.price_rub]);

  const calculatedOriginalPrice = useMemo(() => {
    if (!form.original_price_rub || form.original_price_rub <= 0) return 0;
    return Math.round(form.original_price_rub / 30);
  }, [form.original_price_rub]);

  const forecast = useMemo(() => {
      if (!calculatedPrice || calculatedPrice <= 0) return "-";
      const monthsNeeded = calculatedPrice / 50;
      if (monthsNeeded <= 1) return "около 1 месяца";
      if (monthsNeeded <= 18) return `около ${Math.round(monthsNeeded)} мес.`;
      const years = (monthsNeeded / 12).toFixed(1);
      return `около ${years} лет`;
  }, [calculatedPrice]);

  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // --- 4. ОБНОВЛЯЕМ ЛОГИКУ ОТПРАВКИ ФОРМЫ ---
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const isEditing = !!editingItemId;

    let itemDataToSend;

    if (isEditing) {
      // Логика для РЕДАКТИРОВАНИЯ
      const newCodes = form.is_auto_issuance ? form.new_item_codes.split('\n').filter(Boolean) : [];
      itemDataToSend = {
        name: form.name,
        description: form.description,
        price: calculatedPrice,
        price_rub: parseInt(form.price_rub, 10),
        image_url: form.image_url,
        original_price: calculatedOriginalPrice > 0 ? calculatedOriginalPrice : null,
        added_stock: form.is_auto_issuance ? 0 : parseInt(form.added_stock, 10) || 0,
        new_item_codes: newCodes
      };
    } else {
      // Логика для СОЗДАНИЯ
      const codes = form.is_auto_issuance ? form.codes_text.split('\n').filter(Boolean) : [];
      if (form.is_auto_issuance && codes.length === 0) {
        showAlert('Для товаров с автовыдачей добавьте хотя бы один код.', 'error');
        setLoading(false);
        return;
      }
      itemDataToSend = {
        name: form.name,
        description: form.description,
        price: calculatedPrice,
        price_rub: parseInt(form.price_rub, 10),
        stock: form.is_auto_issuance ? codes.length : parseInt(form.stock, 10),
        image_url: form.image_url,
        original_price: calculatedOriginalPrice > 0 ? calculatedOriginalPrice : null,
        is_auto_issuance: form.is_auto_issuance,
        item_codes: codes
      };
    }

    try {
      if (isEditing) {
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
      showAlert(error.response?.data?.detail || 'Произошла ошибка.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // --- 5. ОБНОВЛЯЕМ ЛОГИКУ РЕДАКТИРОВАНИЯ ---
  const handleEdit = (item) => {
    setEditingItemId(item.id);
    setForm({
        name: item.name,
        description: item.description || '',
        price_rub: item.price_rub,
        original_price_rub: item.original_price ? item.original_price * 30 : '', // Исправлено на 30, как в калькуляторе
        stock: item.stock,
        image_url: item.image_url || '',
        is_auto_issuance: item.is_auto_issuance,
        codes_text: '',
        added_stock: '',
        new_item_codes: ''
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

  // --- 6. ДОБАВЛЯЕМ НОВУЮ ФУНКЦИЮ ПОЛНОГО УДАЛЕНИЯ ---
  const handleDeletePermanently = async (itemId, itemName) => {
    const isConfirmed = await confirm('ПОЛНОЕ УДАЛЕНИЕ', `Вы уверены, что хотите НАВСЕГДА удалить товар "${itemName}"? Это действие необратимо.`);
    if (isConfirmed) {
      setLoading(true);
      try {
        await deleteMarketItemPermanently(itemId);
        showAlert('Товар удален навсегда.', 'success');
        fetchItems();
        clearCache('market');
      } catch (error) {
        showAlert('Ошибка при удалении.', 'error');
      } finally {
        setLoading(false);
      }
    }
  };
  
  return (
    <>
      <div className={styles.card}>
        <h2>{editingItemId ? 'Редактирование товара' : 'Создать новый товар'}</h2>
        <form onSubmit={handleFormSubmit}>
          {/* ... Поля image_url, name, description, price_rub, original_price_rub ... */}
          
          {/* --- 7. ОБНОВЛЯЕМ JSX ДЛЯ ОТОБРАЖЕНИЯ ПОЛЕЙ СКЛАДА --- */}
          <div className={styles.checkboxContainer}>
            <input
              type="checkbox"
              id="is_auto_issuance"
              name="is_auto_issuance"
              checked={form.is_auto_issuance}
              onChange={handleFormChange}
              disabled={!!editingItemId} 
            />
            <label htmlFor="is_auto_issuance">Автовыдача товара (сертификаты, коды)</label>
          </div>

          {form.is_auto_issuance ? (
            <>
              {editingItemId ? (
                <textarea
                  name="new_item_codes"
                  value={form.new_item_codes}
                  onChange={handleFormChange}
                  placeholder="Добавить новые коды/ссылки (каждый с новой строки)"
                  className={styles.textarea}
                  rows={4}
                />
              ) : (
                <textarea
                  name="codes_text"
                  value={form.codes_text}
                  onChange={handleFormChange}
                  placeholder="Вставьте сюда коды или ссылки. Каждый код с новой строки."
                  className={styles.textarea}
                  rows={5}
                />
              )}
              <div className={styles.pricePreview}>
                <p>Текущий остаток: <strong>{editingItemId ? form.stock : '...'}</strong></p>
                <p>Будет добавлено: <strong>{(editingItemId ? form.new_item_codes : form.codes_text).split('\n').filter(Boolean).length}</strong></p>
              </div>
            </>
          ) : (
            <>
              {editingItemId ? (
                <input type="number" name="added_stock" value={form.added_stock} onChange={handleFormChange} placeholder={`Текущий остаток: ${form.stock}. Добавить еще:`} className={styles.input} min="0" />
              ) : (
                <input type="number" name="stock" value={form.stock} onChange={handleFormChange} placeholder="Количество на складе" className={styles.input} required min="0" />
              )}
            </>
          )}

          <button type="submit" disabled={loading} className={styles.buttonGreen}>
            {editingItemId ? 'Сохранить' : 'Создать'}
          </button>
          {editingItemId && <button type="button" onClick={resetForm} className={styles.buttonGrey}>Отмена</button>}
        </form>
      </div>
      
      {/* ... Табы ... */}

      <div className={styles.card}>
        <h2>{view === 'active' ? 'Активные товары' : 'Архив товаров'}</h2>
        <div className={styles.list}>
          {(view === 'active' ? items : archivedItems).map(item => (
            <div key={item.id} className={styles.listItem}>
              {/* ... Отображение товара ... */}
              <div className={styles.listItemActions}>
                {view === 'active' ? (
                  <>
                    <button onClick={() => handleEdit(item)} className={styles.buttonSmall}>✏️</button>
                    <button onClick={() => handleArchive(item.id)} className={styles.buttonSmallRed}>🗑️</button>
                  </>
                ) : (
                  // --- 8. ОБНОВЛЯЕМ КНОПКИ В АРХИВЕ ---
                  <>
                    <button onClick={() => handleRestore(item.id)} className={styles.restoreButton}><FaArchive />Восстановить</button>
                    <button onClick={() => handleDeletePermanently(item.id, item.name)} className={styles.buttonSmallRed}><FaTrash /> Удалить</button>
                  </>
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
