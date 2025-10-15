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
  added_stock: '',      // Для пополнения обычных товаров
  new_item_codes: ''    // Для пополнения кодов
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

    try {
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
        await updateMarketItem(editingItemId, itemDataToSend);
        showAlert('Товар успешно обновлен!', 'success');
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
        stock: item.stock, // Показываем текущий остаток
        image_url: item.image_url || '',
        is_auto_issuance: item.is_auto_issuance,
        // Очищаем поля для создания и пополнения
        codes_text: item.codes ? item.codes.map(c => c.code_value).join('\n') : '',
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
            placeholder="Ссылка на изображение (URL) 1080х720px" 
            className={styles.input} 
          />
          
          <input type="text" name="name" value={form.name} onChange={handleFormChange} placeholder="Название товара" className={styles.input} required />

          {/* --- НАЧАЛО ИСПРАВЛЕНИЙ --- */}
          <div className={styles.descriptionWrapper}>
            <textarea
              name="description"
              placeholder="Описание"
              // 1. Используем значение из правильного состояния `form`
              value={form.description}
              // 2. Используем правильный обработчик
              onChange={handleFormChange}
              maxLength="120"
              className={styles.textarea}
            />
            {/* 3. Длину считаем тоже от `form.description` */}
            <span className={styles.charCounter}>{(form.description || '').length} / 120</span>
          </div>
          {/* --- КОНЕЦ ИСПРАВЛЕНИЙ --- */}
          
          <input type="number" name="price_rub" value={form.price_rub} onChange={handleFormChange} placeholder="Цена в рублях" className={styles.input} required min="0" />
          <input type="number" name="original_price_rub" value={form.original_price_rub} onChange={handleFormChange} placeholder="Старая цена в рублях (для скидки)" className={styles.input} min="0" />
          
          {(form.price_rub > 0 || form.original_price_rub > 0) && (
              <div className={styles.pricePreview}>
                <p>Цена в спасибках: <strong>{calculatedPrice}</strong></p>
                {calculatedOriginalPrice > 0 && (
                  <p>Старая цена в спасибках: <strong>{calculatedOriginalPrice}</strong></p>
                )}
                <p>
                  Прогноз накопления
                  <span style={{color: '#5CA14A', fontWeight: '500'}}>
                    {calculatedOriginalPrice > 0 ? " (по скидке)" : ""}
                  </span>: 
                  <strong> {forecast}</strong>
                </p>
              </div>
          )}

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
            // --- Логика для товаров с автовыдачей ---
            <>
              {editingItemId ? (
                // Поле для ПОПОЛНЕНИЯ кодов в режиме редактирования
                <textarea
                  name="new_item_codes"
                  value={form.new_item_codes}
                  onChange={handleFormChange}
                  placeholder="Добавить новые коды/ссылки (каждый с новой строки)"
                  className={styles.textarea}
                  rows={4}
                />
              ) : (
                // Поле для ПЕРВИЧНОГО добавления кодов в режиме создания
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
            // --- Логика для ОБЫЧНЫХ товаров ---
            <>
              {editingItemId ? (
                // Поле для ПОПОЛНЕНИЯ остатка в режиме редактирования
                <input type="number" name="added_stock" value={form.added_stock} onChange={handleFormChange} placeholder={`Текущий остаток: ${form.stock}. Добавить еще:`} className={styles.input} min="0" />
              ) : (
                // Поле для ПЕРВИЧНОГО указания остатка в режиме создания
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
                {item.is_auto_issuance && <p style={{color: '#007bff', fontSize: '12px', fontWeight: 'bold'}}>Автовыдача</p>}
                {item.original_price && item.original_price > item.price ? (
                  <p>
                    Цена: {item.price} (было <s style={{color: '#999'}}>{item.original_price}</s>) спасибок
                  </p>
                ) : (
                  <p>Цена: {item.price} спасибок ({item.price_rub} ₽)</p>
                )}
                <p>Остаток: {item.stock} шт.</p>
              </div>
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
