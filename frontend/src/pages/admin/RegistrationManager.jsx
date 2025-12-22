// frontend/src/pages/admin/RegistrationManager.jsx

import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaCopy, FaEye, FaEyeSlash } from 'react-icons/fa';
import { getPendingUsers, approveUserRegistration, rejectUserRegistration } from '../../api';
import styles from '../AdminPage.module.css';
import registrationStyles from './RegistrationManager.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { formatDateForDisplay } from '../../utils/dateFormatter';

function RegistrationManager() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [pendingUsers, setPendingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState(new Set());
  const [approvedCredentials, setApprovedCredentials] = useState({}); // { userId: { login, password } }
  const [showPasswords, setShowPasswords] = useState({}); // { userId: true/false }
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [modalCredentials, setModalCredentials] = useState(null); // { login, password }
  const [showModalPassword, setShowModalPassword] = useState(false);

  const loadPendingUsers = async () => {
    try {
      setLoading(true);
      const response = await getPendingUsers();
      setPendingUsers(response.data);
    } catch (error) {
      showAlert('Не удалось загрузить список заявок', 'error');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPendingUsers();
  }, []);

  const handleApprove = async (userId) => {
    const user = pendingUsers.find(u => u.id === userId);
    const isConfirmed = await confirm(
      'Одобрение регистрации',
      `Вы уверены, что хотите одобрить регистрацию пользователя ${user?.first_name} ${user?.last_name}?`
    );
    
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(userId));
    try {
      const response = await approveUserRegistration(userId);
      const data = response.data;
      
      // Если были сгенерированы учетные данные, сохраняем их для отображения
      if (data.credentials_generated && data.login && data.password) {
        const credentials = {
          login: data.login,
          password: data.password
        };
        
        setApprovedCredentials(prev => ({
          ...prev,
          [userId]: credentials
        }));
        
        // Сохраняем данные в sessionStorage для автозаполнения на странице входа
        sessionStorage.setItem('pendingLoginCredentials', JSON.stringify(credentials));
        
        // Показываем модальное окно с данными
        setModalCredentials(credentials);
        setShowCredentialsModal(true);
      }
      
      showAlert('Регистрация одобрена', 'success');
      await loadPendingUsers();
    } catch (error) {
      showAlert(error.response?.data?.detail || 'Не удалось одобрить регистрацию', 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const copyToClipboard = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      showAlert(`${label} скопирован в буфер обмена`, 'success');
    } catch (err) {
      showAlert(`Не удалось скопировать ${label}`, 'error');
    }
  };

  const togglePasswordVisibility = (userId) => {
    setShowPasswords(prev => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  };

  const handleGoToLogin = () => {
    // Сохраняем данные в sessionStorage для автозаполнения
    if (modalCredentials) {
      sessionStorage.setItem('pendingLoginCredentials', JSON.stringify(modalCredentials));
    }
    // Закрываем модальное окно
    setShowCredentialsModal(false);
    setModalCredentials(null);
    // Перенаправляем на страницу входа (обновляем URL или используем window.location)
    window.location.href = '/';
  };

  const handleCloseModal = () => {
    setShowCredentialsModal(false);
    setModalCredentials(null);
    setShowModalPassword(false);
  };

  const handleReject = async (userId) => {
    const user = pendingUsers.find(u => u.id === userId);
    const isConfirmed = await confirm(
      'Отклонение регистрации',
      `Вы уверены, что хотите отклонить регистрацию пользователя ${user?.first_name} ${user?.last_name}?`
    );
    
    if (!isConfirmed) return;

    setProcessingIds(prev => new Set(prev).add(userId));
    try {
      await rejectUserRegistration(userId);
      showAlert('Регистрация отклонена', 'success');
      await loadPendingUsers();
    } catch (error) {
      showAlert(error.response?.data?.detail || 'Не удалось отклонить регистрацию', 'error');
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  if (loading) {
    return <div className={styles.card}>Загрузка...</div>;
  }

  if (pendingUsers.length === 0) {
    return (
      <div className={styles.card}>
        <h2>Заявки на регистрацию</h2>
        <p>Нет заявок, ожидающих рассмотрения</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <h2>Заявки на регистрацию ({pendingUsers.length})</h2>
      <div className={registrationStyles.usersList}>
        {pendingUsers.map(user => {
          const isProcessing = processingIds.has(user.id);
          const credentials = approvedCredentials[user.id];
          const showPassword = showPasswords[user.id];
          const isWebUser = !user.telegram_id || user.telegram_id < 0;
          
          return (
            <div key={user.id} className={registrationStyles.userCard}>
              <div className={registrationStyles.userInfo}>
                <h3>{user.first_name || ''} {user.last_name || ''}</h3>
                <div className={registrationStyles.userDetails}>
                  <p><strong>Должность:</strong> {user.position || 'не указана'}</p>
                  <p><strong>Подразделение:</strong> {user.department || 'не указано'}</p>
                  <p><strong>Телефон:</strong> {user.phone_number || 'не указан'}</p>
                  <p><strong>Дата рождения:</strong> {formatDateForDisplay(user.date_of_birth) || 'не указана'}</p>
                  {user.telegram_id && <p><strong>Telegram ID:</strong> {user.telegram_id}</p>}
                  <p><strong>Дата регистрации:</strong> {formatDateForDisplay(user.registration_date) || 'не указана'}</p>
                </div>
                
                {/* Отображение сгенерированных учетных данных для веб-пользователей */}
                {credentials && isWebUser && (
                  <div className={registrationStyles.credentialsBox}>
                    <p className={registrationStyles.credentialsTitle}>
                      <strong>⚠️ Сохраните данные для входа:</strong>
                    </p>
                    <div className={registrationStyles.credentialItem}>
                      <label>Логин:</label>
                      <div className={registrationStyles.credentialValue}>
                        <span>{credentials.login}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(credentials.login, 'Логин')}
                          className={registrationStyles.copyButton}
                          title="Копировать логин"
                        >
                          <FaCopy />
                        </button>
                      </div>
                    </div>
                    <div className={registrationStyles.credentialItem}>
                      <label>Пароль:</label>
                      <div className={registrationStyles.credentialValue}>
                        <span>{showPassword ? credentials.password : '••••••••••••'}</span>
                        <button
                          type="button"
                          onClick={() => togglePasswordVisibility(user.id)}
                          className={registrationStyles.eyeButton}
                          title={showPassword ? "Скрыть пароль" : "Показать пароль"}
                        >
                          {showPassword ? <FaEyeSlash /> : <FaEye />}
                        </button>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(credentials.password, 'Пароль')}
                          className={registrationStyles.copyButton}
                          title="Копировать пароль"
                        >
                          <FaCopy />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className={registrationStyles.actions}>
                <button
                  onClick={() => handleApprove(user.id)}
                  disabled={isProcessing}
                  className={registrationStyles.approveButton}
                  title="Одобрить"
                >
                  <FaCheck /> Одобрить
                </button>
                <button
                  onClick={() => handleReject(user.id)}
                  disabled={isProcessing}
                  className={registrationStyles.rejectButton}
                  title="Отклонить"
                >
                  <FaTimes /> Отклонить
                </button>
              </div>
            </div>
          );
        })}
      </div>
      
      {/* Модальное окно с учетными данными */}
      {showCredentialsModal && modalCredentials && (
        <div className={registrationStyles.modalOverlay} onClick={handleCloseModal}>
          <div className={registrationStyles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h2 className={registrationStyles.modalTitle}>Регистрация одобрена!</h2>
            <p className={registrationStyles.modalWarning}>
              ⚠️ <strong>Сохраните данные для входа:</strong>
            </p>
            <div className={registrationStyles.modalCredentials}>
              <div className={registrationStyles.modalCredentialItem}>
                <label>Логин:</label>
                <div className={registrationStyles.modalCredentialValue}>
                  <span>{modalCredentials.login}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(modalCredentials.login, 'Логин')}
                    className={registrationStyles.modalCopyButton}
                    title="Копировать логин"
                  >
                    <FaCopy />
                  </button>
                </div>
              </div>
              <div className={registrationStyles.modalCredentialItem}>
                <label>Пароль:</label>
                <div className={registrationStyles.modalCredentialValue}>
                  <span>{showModalPassword ? modalCredentials.password : '••••••••••••'}</span>
                  <button
                    type="button"
                    onClick={() => setShowModalPassword(!showModalPassword)}
                    className={registrationStyles.modalEyeButton}
                    title={showModalPassword ? "Скрыть пароль" : "Показать пароль"}
                  >
                    {showModalPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(modalCredentials.password, 'Пароль')}
                    className={registrationStyles.modalCopyButton}
                    title="Копировать пароль"
                  >
                    <FaCopy />
                  </button>
                </div>
              </div>
            </div>
            <div className={registrationStyles.modalButtons}>
              <button
                onClick={handleGoToLogin}
                className={registrationStyles.modalGoToLoginButton}
              >
                Перейти к входу
              </button>
              <button
                onClick={handleCloseModal}
                className={registrationStyles.modalCloseButton}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default RegistrationManager;
