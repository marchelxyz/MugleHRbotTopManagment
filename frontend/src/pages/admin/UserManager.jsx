// frontend/src/pages/admin/UserManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
// --- 1. ИМПОРТИРУЕМ ВСЕ НУЖНЫЕ ИКОНКИ ---
import { FaPencilAlt, FaTimes, FaDownload } from 'react-icons/fa';
import { adminGetAllUsers, adminUpdateUser, adminDeleteUser, exportAllUsers } from '../../api';
import userManagerStyles from './UserManager.module.css'; // Используем один файл стилей
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { formatDateForDisplay } from '../../utils/dateFormatter';

// Модальное окно для редактирования (без изменений)
function EditUserModal({ user, onClose, onSave }) {
    const { confirm } = useConfirmation();
    const [formData, setFormData] = useState({
        ...user,
        date_of_birth: formatDateForDisplay(user.date_of_birth),
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        onSave(user.id, formData);
    };

    const handleDelete = async () => {
        const isConfirmed = await confirm(
            'Сброс пользователя',
            `Вы уверены, что хотите сбросить пользователя ${user.first_name}? Он будет отправлен на повторную регистрацию.`
        );
        if (isConfirmed) {
            onSave(user.id, { ...formData, id_to_delete: user.id, action: 'delete' });
        }
    };
    
    // ... (остальной код модального окна без изменений)

    return (
        <div className={userManagerStyles.modalBackdrop} onClick={onClose}>
            <div className={userManagerStyles.modalContent} onClick={e => e.stopPropagation()}>
                <button onClick={onClose} className={userManagerStyles.closeButton}><FaTimes /></button>
                <h2>Редактирование: {user.first_name} {user.last_name}</h2>
                <form onSubmit={handleSave}>
                    <div className={userManagerStyles.formGrid}>
                        <input name="first_name" value={formData.first_name || ''} onChange={handleChange} placeholder="Имя" className={userManagerStyles.input} />
                        <input name="last_name" value={formData.last_name || ''} onChange={handleChange} placeholder="Фамилия" className={userManagerStyles.input} />
                        <input name="department" value={formData.department || ''} onChange={handleChange} placeholder="Подразделение" className={userManagerStyles.input} />
                        <input name="position" value={formData.position || ''} onChange={handleChange} placeholder="Должность" className={userManagerStyles.input} />
                        <input type="tel" name="phone_number" value={formData.phone_number || ''} onChange={handleChange} placeholder="Номер телефона" className={userManagerStyles.input} />
                        <input type="text" name="date_of_birth" value={formData.date_of_birth || ''} onChange={handleChange} placeholder="Дата (ДД.ММ.ГГГГ)" className={userManagerStyles.input} />
                        <input type="number" name="balance" value={formData.balance || 0} onChange={handleChange} placeholder="Баланс" className={userManagerStyles.input} />
                        <input type="number" name="tickets" value={formData.tickets || 0} onChange={handleChange} placeholder="Билеты" className={userManagerStyles.input} />
                        <input type="number" name="ticket_parts" value={formData.ticket_parts || 0} onChange={handleChange} placeholder="Части билетов" className={userManagerStyles.input} />
                        <select name="status" value={formData.status} onChange={handleChange} className={userManagerStyles.select}>
                            <option value="approved">Активен</option>
                            <option value="blocked">Заблокирован</option>
                        </select>
                    </div>
                    <div className={userManagerStyles.modalActions}>
                        <button type="submit" className={`${userManagerStyles.modalButton} ${userManagerStyles.buttonGreen}`}>Сохранить</button>
                        <button type="button" onClick={onClose} className={`${userManagerStyles.modalButton} ${userManagerStyles.buttonGrey}`}>Отмена</button>
                        <button type="button" onClick={handleDelete} className={`${userManagerStyles.modalButton} ${userManagerStyles.buttonRed}`}>Удалить</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

// Основной компонент
function UserManager() {
    const { showAlert } = useModalAlert();
    const [allUsers, setAllUsers] = useState([]);
    const [view, setView] = useState('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isExporting, setIsExporting] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await adminGetAllUsers();
            setAllUsers(response.data);
        } catch (error) {
            showAlert('Ошибка загрузки пользователей.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    const handleSaveUser = async (userId, userData) => {
        // ... (код функции без изменений)
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

    const handleExport = async () => {
        setIsExporting(true);
        try {
            const response = await exportAllUsers();
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `all_users_${new Date().toISOString().slice(0, 10)}.xlsx`);
            document.body.appendChild(link);
            link.click();
            link.parentNode.removeChild(link);
        } catch (err) {
            console.error('Ошибка при экспорте пользователей:', err);
            showAlert('Не удалось скачать отчет.', 'error');
        } finally {
            setIsExporting(false);
        }
    };

    if (loading) return <p>Загрузка пользователей...</p>;

    // --- ИСПРАВЛЕНИЕ: Убираем лишний return и используем один корневой <div> ---
    return (
        <div>
            <div className={userManagerStyles.header}>
                <h2>Управление пользователями</h2>
                <button
                    className={userManagerStyles.exportButton}
                    onClick={handleExport}
                    disabled={isExporting}
                >
                    <FaDownload />
                    {isExporting ? 'Экспорт...' : 'Скачать список'}
                </button>
            </div>

            {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} onSave={handleSaveUser} />}

            <div className={userManagerStyles.card}>
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Поиск по имени, фамилии, @username..."
                    className={userManagerStyles.input}
                />
            </div>

            <div className={userManagerStyles.tabs}>
                <button onClick={() => setView('active')} className={view === 'active' ? userManagerStyles.tabActive : userManagerStyles.tab}>Активные</button>
                <button onClick={() => setView('blocked')} className={view === 'blocked' ? userManagerStyles.tabActive : userManagerStyles.tab}>Заблокированные</button>
            </div>

            <div className={userManagerStyles.userListContainer}>
                {filteredUsers.length > 0 ? filteredUsers.map(user => (
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
                            <button onClick={() => setEditingUser(user)} className={userManagerStyles.iconButton}>
                                <FaPencilAlt />
                            </button>
                        </div>
                    </div>
                )) : <p>Пользователи не найдены.</p>}
            </div>
        </div>
    );
}

export default UserManager;
