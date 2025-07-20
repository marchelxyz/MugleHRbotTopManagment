// frontend/src/pages/AdminPage.jsx

import React, { useState } from 'react';
// 1. Импортируем обе функции: для начисления баллов и для создания товара
import { addPointsToAll, createMarketItem } from '../api';
import styles from './AdminPage.module.css';

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
