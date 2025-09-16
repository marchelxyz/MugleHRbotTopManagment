// frontend/src/pages/admin/UserManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
// --- 1. ИМПОРТИРУЕМ ИКОНКИ ---
import { FaPencilAlt, FaTimes } from 'react-icons/fa';
import { adminGetAllUsers, adminUpdateUser, adminDeleteUser } from '../../api';
import styles from '../AdminPage.module.css';
import userManagerStyles from './UserManager.module.css';

// Модальное окно для редактирования
function EditUserModal({ user, onClose, onSave }) {
  const [formData, setFormData] = useState(user);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    onSave(user.id, formData);
  };

  const handleDelete = () => {
    if (window.confirm(`Вы уверены, что хотите сбросить пользователя ${user.first_name}? Он будет отправлен на повторную регистрацию.`)) {
      onSave(user.id, { ...formData, id_to_delete: user.id, action: 'delete' });
    }
  };

  const handleBlockToggle = () => {
    const newStatus = user.status === 'blocked' ? 'approved' : 'blocked';
    const actionText = newStatus === 'blocked' ? 'разблокировать' : 'заблокировать';
    if (window.confirm(`Вы уверены, что хотите ${actionText} пользователя ${user.first_name}?`)) {
      onSave(user.id, { ...formData, status: newStatus });
    }
  };

  return (
    <div className={userManagerStyles.modalBackdrop} onClick={onClose}>
      <div className={userManagerStyles.modalContent} onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className={userManagerStyles.closeButton}><FaTimes /></button>
        
        <h2>Редактирование: {user.first_name} {user.last_name}</h2>
        <form onSubmit={handleSave}>
          <div className={userManagerStyles.formGrid}>
            <input name="first_name" value={formData.first_name || ''} onChange={handleChange} placeholder="Имя" className={styles.input} />
            <input name="last_name" value={formData.last_name || ''} onChange={handleChange} placeholder="Фамилия" className={styles.input} />
            <input name="department" value={formData.department || ''} onChange={handleChange} placeholder="Подразделение" className={styles.input} />
            <input name="position" value={formData.position || ''} onChange={handleChange} placeholder="Должность" className={styles.input} />
            
            {/* --- ДОБАВЛЯЕМ ПОЛЕ ДЛЯ ТЕЛЕФОНА --- */}
            <input type="tel" name="phone_number" value={formData.phone_number || ''} onChange={handleChange} placeholder="Номер телефона" className={styles.input} />
            
            <input type="number" name="balance" value={formData.balance || 0} onChange={handleChange} placeholder="Баланс" className={styles.input} />
            <input type="number" name="tickets" value={formData.tickets || 0} onChange={handleChange} placeholder="Билеты" className={styles.input} />
            <input type="number" name="ticket_parts" value={formData.ticket_parts || 0} onChange={handleChange} placeholder="Части билетов" className={styles.input} />
            <select name="status" value={formData.status} onChange={handleChange} className={styles.select}>
              <option value="approved">Активен</option>
              <option value="pending">В ожидании</option>
              <option value="rejected">Отклонен</option>
              <option value="blocked">Заблокирован</option>
            </select>
          </div>
          <div className={userManagerStyles.modalActions}>
            <button type="submit" className={`${userManagerStyles.modalButton} ${styles.buttonGreen}`}>Сохранить</button>
            <button type="button" onClick={handleBlockToggle} className={`${userManagerStyles.modalButton} ${userManagerStyles.buttonYellow}`}>
              {user.status === 'blocked' ? 'Разблокировать' : 'Заблокировать'}
            </button>
            <button type="button" onClick={handleDelete} className={`${userManagerStyles.modalButton} ${userManagerStyles.buttonRed}`}>Удалить</button>
            <button type="button" onClick={onClose} className={`${userManagerStyles.modalButton} ${styles.buttonGrey}`}>Отмена</button>
          </div>
        </form>
      </div>
    </div>
  );
}


// Основной компонент
function UserManager() {
  const [allUsers, setAllUsers] = useState([]);
  const [view, setView] = useState('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await adminGetAllUsers();
      setAllUsers(response.data);
    } catch (error) {
      setMessage('Ошибка загрузки пользователей.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (userId, userData) => {
    setMessage('');
    try {
      if (userData.action === 'delete') {
        await adminDeleteUser(userId);
        setMessage('Пользователь успешно сброшен.');
      } else {
        await adminUpdateUser(userId, userData);
        setMessage('Данные пользователя обновлены.');
      }
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      setMessage('Произошла ошибка при сохранении.');
    }
  };

  const filteredUsers = useMemo(() => {
    const targetStatus = view === 'blocked' ? 'blocked' : 'approved';
    let users = allUsers.filter(user => user.status === targetStatus);

    if (searchQuery.length > 1) {
      const lowercasedQuery = searchQuery.toLowerCase();
      users = users.filter(user =>
        user.first_name?.toLowerCase().includes(lowercasedQuery) ||
        user.last_name?.toLowerCase().includes(lowercasedQuery) ||
        user.username?.toLowerCase().includes(lowercasedQuery)
      );
    }
    return users;
  }, [allUsers, view, searchQuery]);

  if (loading) return <p>Загрузка пользователей...</p>;

  return (
    <>
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveUser} />}
      
      <div className={styles.card}>
        <h2>Поиск сотрудников</h2>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Начните вводить..."
          className={styles.input}
        />
      </div>

      <div className={styles.tabs}>
        <button onClick={() => setView('active')} className={view === 'active' ? styles.tabActive : styles.tab}>Активные</button>
        <button onClick={() => setView('blocked')} className={view === 'blocked' ? styles.tabActive : styles.tab}>Заблокированные</button>
      </div>

      <div className={styles.card}>
        {message && <p className={styles.message}>{message}</p>}
        <div className={userManagerStyles.userList}>
          {filteredUsers.map(user => (
            <div key={user.id} className={userManagerStyles.userItem}>
              <div className={userManagerStyles.userInfo}>
                <strong>{user.first_name} {user.last_name}</strong>
                <span>@{user.username || '...'} | {user.position}</span>
              </div>
              <div className={userManagerStyles.userStats}>
                <span>Спасибок: {user.balance}</span>
                <span>Билетов: {user.tickets} ({user.ticket_parts}/2)</span>
              </div>
              <div className={userManagerStyles.userActions}>
                {/* --- 4. ЗАМЕНЯЕМ ТЕКСТОВУЮ КНОПКУ НА ИКОНКУ --- */}
                <button onClick={() => setEditingUser(user)} className={`${styles.buttonSmall} ${userManagerStyles.iconButton}`}>
                  <FaPencilAlt />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

export default UserManager;
