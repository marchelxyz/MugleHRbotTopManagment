// frontend/src/pages/admin/ItemManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
import { createMarketItem, getAllMarketItems, updateMarketItem, archiveMarketItem, getArchivedMarketItems, restoreMarketItem } from '../../api';
import styles from '../AdminPage.module.css';
import { FaArchive } from 'react-icons/fa'; // Импортируем иконку

// --- Выносим логику расчета на фронтенд для динамического отображения ---
function calculateSpasibkiPrice(priceRub) {
    if (!priceRub || priceRub <= 0) return 0;

    const minRub = 100;
    const maxRub = 150000;
    const minRate = 30;
    const maxRate = 150;

    if (priceRub <= minRub) {
        return Math.round(priceRub / minRate);
    }
    if (priceRub >= maxRub) {
        return Math.round(priceRub / maxRate);
    }

    const lnMinRub = Math.log(minRub);
    const lnMaxRub = Math.log(maxRub);
    const lnPriceRub = Math.log(priceRub);

    const progress = (lnPriceRub - lnMinRub) / (lnMaxRub - lnMinRub);
    const currentRate = minRate + (maxRate - minRate) * progress;
    const priceSpasibki = priceRub / currentRate;

    return Math.round(priceSpasibki);
}

function calculateAccumulationForecast(priceSpasibki) {
    if (!priceSpasibki || priceSpasibki <= 0) return "-";
    const monthsNeeded = priceSpasibki / 15;
    if (monthsNeeded <= 1) return "около 1 месяца";
    if (monthsNeeded <= 18) return `около ${Math.round(monthsNeeded)} мес.`;
    const years = (monthsNeeded / 12).toFixed(1);
    return `около ${years} лет`;
}
// --------------------------------------------------------------------

const initialItemState = { name: '', description: '', price_rub: '', stock: 1 };

function ItemManager() {
  const [view, setView] = useState('active'); // 'active' или 'archived'
  const [items, setItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  
  const [form, setForm] = useState(initialItemState);
  const [editingItemId, setEditingItemId] = useState(null);
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  // Загружаем все данные при старте
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
      setMessage('Ошибка загрузки списка товаров.');
    } finally {
      setLoading(false);
    }
  };
  
  // Динамический расчет для отображения в форме
  const calculatedPrice = useMemo(() => calculateSpasibkiPrice(form.price_rub), [form.price_rub]);
  const forecast = useMemo(() => calculateAccumulationForecast(calculatedPrice), [calculatedPrice]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    const itemData = {
      ...form,
      price_rub: parseInt(form.price_rub, 10),
      stock: parseInt(form.stock, 10),
    };
    try {
      if (editingItemId) {
        await updateMarketItem(editingItemId, itemData);
        setMessage('Товар успешно обновлен!');
      } else {
        await createMarketItem(itemData);
        setMessage('Товар успешно создан!');
      }
      resetForm();
      fetchItems();
    } catch (error) {
      setMessage('Произошла ошибка.');
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
    });
    window.scrollTo(0, 0);
  };

  const resetForm = () => {
    setForm(initialItemState);
    setEditingItemId(null);
  };

  const handleArchive = async (itemId) => {
    if (window.confirm('Вы уверены, что хотите архивировать этот товар?')) {
      await archiveMarketItem(itemId);
      fetchItems();
    }
  };

  const handleRestore = async (itemId) => {
    if (window.confirm('Вы уверены, что хотите восстановить этот товар?')) {
      await restoreMarketItem(itemId);
      fetchItems();
    }
  };

  return (
    <>
      <div className={styles.card}>
        <h2>{editingItemId ? 'Редактирование товара' : 'Создать новый товар'}</h2>
        <form onSubmit={handleFormSubmit}>
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
          {message && <p className={styles.message}>{message}</p>}
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
