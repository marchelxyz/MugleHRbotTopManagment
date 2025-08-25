// frontend/src/pages/admin/ItemManager.jsx

import React, { useState } from 'react';
import { createMarketItem } from '../../api';
import styles from '../AdminPage.module.css';

function ItemManager() {
  const [newItem, setNewItem] = useState({
    name: '',
    description: '',
    price: 10,
    stock: 1,
  });
  const [createItemLoading, setCreateItemLoading] = useState(false);
  const [createItemMessage, setCreateItemMessage] = useState('');

  const handleItemChange = (e) => {
    const { name, value } = e.target;
    setNewItem(prev => ({ ...prev, [name]: value }));
  };

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
      setNewItem({ name: '', description: '', price: 10, stock: 1 });
    } catch (error) {
      setCreateItemMessage('Ошибка при создании товара.');
    } finally {
      setCreateItemLoading(false);
    }
  };

  return (
    <div className={styles.card}>
      <h2>Создать новый товар</h2>
      <form onSubmit={handleCreateItem}>
        <input type="text" name="name" value={newItem.name} onChange={handleItemChange} placeholder="Название товара" className={styles.input} required />
        <textarea name="description" value={newItem.description} onChange={handleItemChange} placeholder="Описание товара" className={styles.textarea} />
        <input type="number" name="price" value={newItem.price} onChange={handleItemChange} placeholder="Цена в баллах" className={styles.input} required min="0" />
        <input type="number" name="stock" value={newItem.stock} onChange={handleItemChange} placeholder="Количество на складе" className={styles.input} required min="0" />
        <button type="submit" disabled={createItemLoading} className={styles.buttonGreen}>
          {createItemLoading ? 'Создание...' : 'Создать товар'}
        </button>
        {createItemMessage && <p className={styles.message}>{createItemMessage}</p>}
      </form>
    </div>
  );
}

export default ItemManager;
