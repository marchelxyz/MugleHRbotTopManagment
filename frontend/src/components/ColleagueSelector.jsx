// frontend/src/components/ColleagueSelector.jsx

import React, { useState, useEffect } from 'react';
import { getAllUsers } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import styles from './ColleagueSelector.module.css';

const ColleagueSelector = ({ isOpen, onClose, onSelect, currentUserId }) => {
  const { showAlert } = useModalAlert();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
    }
  }, [isOpen]);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredUsers(users.filter(user => user.id !== currentUserId));
    } else {
      const filtered = users.filter(user => 
        user.id !== currentUserId && (
          user.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          `${user.first_name} ${user.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, users, currentUserId]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await getAllUsers();
      setUsers(response.data);
    } catch (error) {
      showAlert('Не удалось загрузить список пользователей', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (user) => {
    onSelect(user);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h3>Выберите коллегу для совместного подарка</h3>
          <button className={styles.closeButton} onClick={onClose}>×</button>
        </div>
        
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Введите имя, фамилию или тег..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
        </div>

        <div className={styles.usersList}>
          {loading ? (
            <div className={styles.loading}>Загрузка...</div>
          ) : filteredUsers.length === 0 ? (
            <div className={styles.noResults}>
              {searchTerm ? 'Пользователи не найдены' : 'Нет доступных пользователей'}
            </div>
          ) : (
            filteredUsers.map(user => (
              <div
                key={user.id}
                className={styles.userItem}
                onClick={() => handleSelect(user)}
              >
                <div className={styles.userAvatar}>
                  {user.telegram_photo_url ? (
                    <img 
                      src={user.telegram_photo_url} 
                      alt={`${user.first_name} ${user.last_name}`}
                      className={styles.avatarImage}
                    />
                  ) : (
                    <div className={styles.avatarPlaceholder}>
                      {user.first_name?.[0]}{user.last_name?.[0]}
                    </div>
                  )}
                </div>
                <div className={styles.userInfo}>
                  <div className={styles.userName}>
                    {user.first_name} {user.last_name}
                  </div>
                  <div className={styles.userDetails}>
                    {user.position} • {user.department}
                  </div>
                  {user.username && (
                    <div className={styles.userUsername}>
                      @{user.username}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ColleagueSelector;