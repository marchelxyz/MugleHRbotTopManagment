// frontend/src/pages/admin/UserManager.jsx

import React, { useState, useEffect } from 'react';
// 1. Меняем 'deleteUser' на 'adminDeleteUser'
import { getAllUsers, updateUser, adminDeleteUser, giveBalance } from '../../api'; 
import styles from './UserManager.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

function UserManager() {
    // ... (весь код до handleDelete остается без изменений)
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const { showAlert } = useModalAlert();
    const { confirm } = useConfirmation();

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await getAllUsers();
            setUsers(response.data);
        } catch (error) {
            showAlert('Не удалось загрузить пользователей.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleUpdate = async (user) => {
        try {
            await updateUser(user.id, {
                role: user.role,
                status: user.status,
                balance: parseInt(user.balance, 10)
            });
            showAlert('Пользователь обновлен.', 'success');
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            showAlert('Ошибка обновления.', 'error');
        }
    };

    const handleDelete = async (userId) => {
        const isConfirmed = await confirm('Удаление', 'Вы уверены, что хотите удалить этого пользователя? Это действие необратимо.');
        if (isConfirmed) {
            try {
                // 2. Меняем вызов функции на правильное имя
                await adminDeleteUser(userId); 
                showAlert('Пользователь удален.', 'success');
                fetchUsers();
            } catch (error) {
                showAlert('Ошибка удаления.', 'error');
            }
        }
    };
    
    // ... (остальной код файла остается без изменений)
    const handleGiveBalance = async (userId) => {
        const amountStr = prompt('Введите сумму для начисления:');
        const amount = parseInt(amountStr, 10);
        if (!isNaN(amount) && amount > 0) {
            try {
                await giveBalance(userId, amount);
                showAlert(`Баланс пользователя пополнен на ${amount}.`, 'success');
                fetchUsers();
            } catch (error) {
                showAlert('Ошибка начисления.', 'error');
            }
        } else if (amountStr) {
            showAlert('Некорректная сумма.', 'warning');
        }
    };

    const handleEditChange = (e, field) => {
        setEditingUser({ ...editingUser, [field]: e.target.value });
    };

    const filteredUsers = users.filter(user => {
        const searchTermLower = searchTerm.toLowerCase();
        const name = user.first_name || '';
        const lastname = user.last_name || '';
        const username = user.username || '';
        const id = user.id ? user.id.toString() : '';
    
        return name.toLowerCase().includes(searchTermLower) ||
               lastname.toLowerCase().includes(searchTermLower) ||
               username.toLowerCase().includes(searchTermLower) ||
               id.includes(searchTermLower);
    });

    return (
        <div className={styles.card}>
            <h2>Управление пользователями</h2>
            <input
                type="text"
                placeholder="Поиск по имени, фамилии, нику или ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
            />
            {loading ? <p>Загрузка...</p> : (
                <div className={styles.tableWrapper}>
                    <table className={styles.table}>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Имя</th>
                                <th>Ник</th>
                                <th>Баланс</th>
                                <th>Роль</th>
                                <th>Статус</th>
                                <th>Действия</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.id}>
                                    <td>{user.id}</td>
                                    <td>{user.first_name} {user.last_name}</td>
                                    <td>@{user.username}</td>
                                    <td>
                                        {editingUser && editingUser.id === user.id ? (
                                            <input type="number" value={editingUser.balance} onChange={(e) => handleEditChange(e, 'balance')} className={styles.input} />
                                        ) : (
                                            user.balance
                                        )}
                                    </td>
                                    <td>
                                        {editingUser && editingUser.id === user.id ? (
                                            <select value={editingUser.role} onChange={(e) => handleEditChange(e, 'role')} className={styles.select}>
                                                <option value="user">User</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                        ) : (
                                            user.role
                                        )}
                                    </td>
                                    <td>
                                        {editingUser && editingUser.id === user.id ? (
                                            <select value={editingUser.status} onChange={(e) => handleEditChange(e, 'status')} className={styles.select}>
                                                <option value="active">Active</option>
                                                <option value="blocked">Blocked</option>
                                                <option value="pending">Pending</option>
                                                <option value="rejected">Rejected</option>
                                            </select>
                                        ) : (
                                            user.status
                                        )}
                                    </td>
                                    <td className={styles.actions}>
                                        {editingUser && editingUser.id === user.id ? (
                                            <>
                                                <button onClick={() => handleUpdate(editingUser)} className={styles.buttonGreen}>Сохранить</button>
                                                <button onClick={() => setEditingUser(null)} className={styles.buttonGrey}>Отмена</button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => setEditingUser({ ...user })} className={styles.buttonSmall}>✏️</button>
                                                <button onClick={() => handleDelete(user.id)} className={styles.buttonSmallRed}>🗑️</button>
                                                <button onClick={() => handleGiveBalance(user.id)} className={styles.buttonSmallGreen}>💰</button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

export default UserManager;
