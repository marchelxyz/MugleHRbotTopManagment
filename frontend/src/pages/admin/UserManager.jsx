// frontend/src/pages/admin/UserManager.jsx

import React, { useState, useEffect, useMemo } from 'react';
// --- ИЗМЕНЕНИЕ: Добавляем иконку FaDownload и функцию exportAllUsers ---
import { FaPencilAlt, FaTimes, FaDownload } from 'react-icons/fa';
import { adminGetAllUsers, adminUpdateUser, adminDeleteUser, exportAllUsers } from '../../api';
import styles from '../AdminPage.module.css';
import userManagerStyles from './UserManager.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { formatDateForDisplay } from '../../utils/dateFormatter';

// Модальное окно для редактирования (остается без изменений)
function EditUserModal({ user, onClose, onSave, onDelete }) {
    const { confirm } = useConfirmation();
    const [formData, setFormData] = useState({
        ...user,
        date_of_birth: formatDateForDisplay(user.date_of_birth),
        login: user.login || '',
        password: '', // Пароль не показываем, только для изменения
        browser_auth_enabled: user.browser_auth_enabled || false,
    });

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleSave = (e) => {
        e.preventDefault();
        onSave(user.id, formData);
    };

   // --- ИЗМЕНЕНИЕ: Логика кнопки теперь соответствует анонимизации ---
    const handleDelete = async () => {
        const isConfirmed = await confirm(
            'Анонимизация пользователя',
            `Вы уверены, что хотите анонимизировать пользователя ${user.first_name}? Его личные данные будут стерты, но история транзакций останется. Это действие необратимо.`
        );
        if (isConfirmed) {
            onDelete(user.id); // Вызываем новую функцию
        }
    };

    const handleBlockToggle = async () => {
        const newStatus = user.status === 'blocked' ? 'approved' : 'blocked';
        const actionText = newStatus === 'blocked' ? 'разблокировать' : 'заблокировать';
        const isConfirmed = await confirm(
            'Изменение статуса',
            `Вы уверены, что хотите ${actionText} пользователя ${user.first_name}?`
        );
        if (isConfirmed) {
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
                        <input type="tel" name="phone_number" value={formData.phone_number || ''} onChange={handleChange} placeholder="Номер телефона" className={styles.input} />
                        <input type="text" name="date_of_birth" value={formData.date_of_birth || ''} onChange={handleChange} placeholder="Дата (ДД.ММ.ГГГГ)" className={styles.input} />
                        <input type="number" name="balance" value={formData.balance || 0} onChange={handleChange} placeholder="Баланс" className={styles.input} />
                        <input type="number" name="tickets" value={formData.tickets || 0} onChange={handleChange} placeholder="Билеты" className={styles.input} />
                        <input type="number" name="ticket_parts" value={formData.ticket_parts || 0} onChange={handleChange} placeholder="Части билетов" className={styles.input} />
                        <select name="status" value={formData.status} onChange={handleChange} className={styles.select}>
                            <option value="approved">Активен</option>
                            <option value="blocked">Заблокирован</option>
                        </select>
                        
                        {/* Разделитель для учетных данных */}
                        <div style={{ gridColumn: '1 / -1', borderTop: '2px solid #ddd', marginTop: '10px', paddingTop: '15px' }}>
                            <h3 style={{ marginTop: 0, marginBottom: '15px', fontSize: '16px', color: '#666' }}>Учетные данные для входа через браузер</h3>
                        </div>
                        
                        <input 
                            type="text" 
                            name="login" 
                            value={formData.login || ''} 
                            onChange={handleChange} 
                            placeholder="Логин (минимум 3 символа)" 
                            className={styles.input}
                            minLength={3}
                        />
                        <input 
                            type="password" 
                            name="password" 
                            value={formData.password || ''} 
                            onChange={handleChange} 
                            placeholder="Пароль (минимум 6 символов, оставьте пустым чтобы не менять)" 
                            className={styles.input}
                            minLength={6}
                        />
                        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', gridColumn: '1 / -1' }}>
                            <input
                                type="checkbox"
                                name="browser_auth_enabled"
                                checked={formData.browser_auth_enabled || false}
                                onChange={handleChange}
                                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <span>Включить вход через браузер (автоматически включается при наличии логина и пароля)</span>
                        </label>
                        {formData.login && (
                            <div style={{ gridColumn: '1 / -1', fontSize: '12px', color: '#666', fontStyle: 'italic' }}>
                                💡 Текущий логин: <strong>{formData.login}</strong>
                            </div>
                        )}
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
    const { showAlert } = useModalAlert();
    const [allUsers, setAllUsers] = useState([]);
    const [view, setView] = useState('active');
    const [searchQuery, setSearchQuery] = useState('');
    const [editingUser, setEditingUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState('');
    // --- ИЗМЕНЕНИЕ: Добавляем состояние для кнопки экспорта ---
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const response = await adminGetAllUsers();
            // --- ВОТ ИСПРАВЛЕНИЕ: Добавляем "санитайзер" данных ---
            const cleanedUsers = response.data.filter(user => user && user.id && user.status !== 'deleted');
            setAllUsers(cleanedUsers);
        } catch (error) {
            showAlert('Ошибка загрузки пользователей.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (userId, userData) => {
        const dateParts = userData.date_of_birth.split('.');
        let apiDate = null;
        if (dateParts.length === 3) {
            apiDate = `${dateParts[2]}-${dateParts[1]}-${dateParts[0]}`;
        }
        
        const dataToSend = { ...userData, date_of_birth: apiDate };
        
        // Если пароль пустой, не отправляем его (чтобы не перезаписывать существующий)
        if (!dataToSend.password || dataToSend.password.trim() === '') {
            delete dataToSend.password;
        }

        try {
            if (dataToSend.action === 'delete') {
                await adminDeleteUser(userId);
                showAlert('Пользователь успешно сброшен.', 'success');
            } else {
                await adminUpdateUser(userId, dataToSend);
                showAlert('Данные пользователя обновлены.', 'success');
            }
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
            const errorMsg = error.response?.data?.detail || 'Произошла ошибка при сохранении.';
            showAlert(errorMsg, 'error');
        }
    };

    // --- ИЗМЕНЕНИЕ: Новая функция для анонимизации ---
    const handleDeleteUser = async (userId) => {
        try {
            await adminDeleteUser(userId);
            showAlert('Пользователь успешно анонимизирован.', 'success');
            setEditingUser(null);
            fetchUsers();
        } catch (error) {
             showAlert(error.response?.data?.detail || 'Ошибка при анонимизации.', 'error');
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

    // --- ИЗМЕНЕНИЕ: Добавляем функцию для экспорта ---
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

    return (
        <>
            {editingUser && (
                <EditUserModal 
                    user={editingUser} 
                    onClose={() => setEditingUser(null)} 
                    onSave={handleSaveUser}
                    onDelete={handleDeleteUser} // <-- Передаем новую функцию
                />
            )}
            
            {/* --- ИЗМЕНЕНИЕ: Добавляем div-обертку для заголовка и кнопки --- */}
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
