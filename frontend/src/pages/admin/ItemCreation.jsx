// frontend/src/pages/admin/ItemCreation.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { clearCache } from '../../storage';
import { createMarketItem, getAllMarketItems, updateMarketItem, archiveMarketItem, getArchivedMarketItems, restoreMarketItem, deleteMarketItemPermanently } from '../../api';
import { FaArchive, FaTrash } from 'react-icons/fa';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import styles from '../AdminPage.module.css';

const initialItemState = {
  name: '',
  description: '',
  price_rub: '',
  original_price_rub: '',
  stock: 1,
  image_url: '',
  is_auto_issuance: false,
  is_shared_gift: false,
  codes_text: '',
  added_stock: '',
  new_item_codes: ''
};

const ItemCreation = () => {
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
    
    if (name === 'is_shared_gift' && checked) {
      setForm(prev => ({
        ...prev,
        [name]: checked,
        is_auto_issuance: false
      }));
    } else if (name === 'is_auto_issuance' && checked) {
      setForm(prev => ({
        ...prev,
        [name]: checked,
        is_shared_gift: false
      }));
    } else {
      setForm(prev => ({
        ...prev,
        [name]: type === 'checkbox' ? checked : value
      }));
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const isEditing = !!editingItemId;
    let itemDataToSend;

    try {
      if (isEditing) {
        const newCodes = form.is_auto_issuance ? form.new_item_codes.split('\n').filter(Boolean) : [];
        itemDataToSend = {
          name: form.name,
          description: form.description,
          price: calculatedPrice,
          price_rub: parseInt(form.price_rub, 10),
          image_url: form.image_url,
          original_price: calculatedOriginalPrice > 0 ? calculatedOriginalPrice : null,
          is_shared_gift: form.is_shared_gift,
          added_stock: form.is_auto_issuance ? 0 : parseInt(form.added_stock, 10) || 0,
          new_item_codes: newCodes
        };
        
        await updateMarketItem(editingItemId, itemDataToSend);
        showAlert('Товар успешно обновлен!', 'success');
      } else {
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
          is_shared_gift: form.is_shared_gift,
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

  const handleEdit = (item) => {
    setEditingItemId(item.id);
    setForm({
        name: item.name,
        description: item.description || '',
        price_rub: item.price_rub,
        original_price_rub: item.original_price ? item.original_price * 30 : '',
        stock: item.stock,
        image_url: item.image_url || '',
        is_auto_issuance: item.is_auto_issuance,
        is_shared_gift: item.is_shared_gift || false,
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

          <div className={styles.descriptionWrapper}>
            <textarea
              name="description"
              placeholder="Описание"
              value={form.description}
              onChange={handleFormChange}
              maxLength="120"
              className={styles.textarea}
            />
            <span className={styles.charCounter}>{(form.description || '').length} / 120</span>
          </div>
          
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

          <div className={styles.checkboxContainer}>
            <input
              type="checkbox"
              id="is_auto_issuance"
              name="is_auto_issuance"
              checked={form.is_auto_issuance}
              onChange={handleFormChange}
              disabled={!!editingItemId || form.is_shared_gift} 
            />
            <label htmlFor="is_auto_issuance">Автовыдача товара (сертификаты, коды)</label>
          </div>

          <div className={styles.checkboxContainer}>
            <input
              type="checkbox"
              id="is_shared_gift"
              name="is_shared_gift"
              checked={form.is_shared_gift}
              onChange={handleFormChange}
              disabled={!!editingItemId || form.is_auto_issuance} 
            />
            <label htmlFor="is_shared_gift">Совместный подарок</label>
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
                {item.is_shared_gift && <p style={{color: '#28a745', fontSize: '12px', fontWeight: 'bold'}}>Совместный подарок</p>}
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
};

export default ItemCreation;