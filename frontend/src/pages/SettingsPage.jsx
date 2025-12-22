// frontend/src/pages/SettingsPage.jsx

import React, { useState } from 'react';
import styles from './SettingsPage.module.css';
import { FaQuestionCircle, FaHeadset, FaFileContract, FaBookOpen, FaLock, FaSignOutAlt } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import { changePassword } from '../api';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

// Определяем, является ли это браузером (не Telegram WebApp)
const isWebBrowser = !window.Telegram?.WebApp;

function SettingsPage({ onBack, onNavigate, onRepeatOnboarding, user }) {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isLoading, setIsLoading] = useState(false);

  // Ссылка на ваш аккаунт поддержки в Telegram
  const supportUrl = 'https://t.me/fix2Form'; // <-- НЕ ЗАБУДЬТЕ ЗАМЕНИТЬ НА ВАШ АККАУНТ

  const handleLogout = async () => {
    const isConfirmed = await confirm(
      'Выход из аккаунта',
      'Вы уверены, что хотите выйти из аккаунта?'
    );
    
    if (isConfirmed) {
      localStorage.removeItem('userId');
      localStorage.removeItem('user');
      window.location.reload();
    }
  };

  const handlePasswordChange = (e) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({ ...prev, [name]: value }));
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      showAlert('Пожалуйста, заполните все поля', 'error');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showAlert('Новый пароль и подтверждение не совпадают', 'error');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      showAlert('Пароль должен содержать минимум 6 символов', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      showAlert('Пароль успешно изменен', 'success');
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setShowChangePassword(false);
    } catch (err) {
      const errorMessage = err.response?.data?.detail || 'Не удалось изменить пароль';
      showAlert(errorMessage, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageLayout title="Настройки">
      <button onClick={onBack} className={styles.backButton}>
        &larr; Назад в профиль
      </button>

      <div className={styles.settingsList}>
        <button onClick={onRepeatOnboarding} className={styles.settingsItem}>
          <FaBookOpen className={styles.icon} />
          <span>Пройти обучение повторно</span>
        </button>
        
        <button onClick={() => onNavigate('faq')} className={styles.settingsItem}>
          <FaQuestionCircle className={styles.icon} />
          <span>Часто задаваемые вопросы (FAQ)</span>
        </button>

        <a href={supportUrl} target="_blank" rel="noopener noreferrer" className={styles.settingsItem}>
          <FaHeadset className={styles.icon} />
          <span>Поддержка</span>
        </a>

        {user && user.login && (
          <button onClick={() => setShowChangePassword(true)} className={styles.settingsItem}>
            <FaLock className={styles.icon} />
            <span>Изменить пароль</span>
          </button>
        )}

        {/* Кнопка выхода показывается только в браузере */}
        {isWebBrowser && (
          <button onClick={handleLogout} className={styles.settingsItem}>
            <FaSignOutAlt className={styles.icon} />
            <span>Выйти из аккаунта</span>
          </button>
        )}

        <div className={styles.settingsItemDisabled}>
          <FaFileContract className={styles.icon} />
          <span>Юридическая документация</span>
        </div>
      </div>

      {showChangePassword && (
        <div className={styles.passwordModal}>
          <div className={styles.passwordModalContent}>
            <h2>Изменение пароля</h2>
            <form onSubmit={handlePasswordSubmit}>
              <div className={styles.passwordInputContainer}>
                <input
                  name="currentPassword"
                  type={showPasswords.current ? "text" : "password"}
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  placeholder="Текущий пароль"
                  className={styles.input}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPasswords(prev => ({ ...prev, current: !prev.current }))}
                >
                  {showPasswords.current ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <div className={styles.passwordInputContainer}>
                <input
                  name="newPassword"
                  type={showPasswords.new ? "text" : "password"}
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  placeholder="Новый пароль"
                  className={styles.input}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPasswords(prev => ({ ...prev, new: !prev.new }))}
                >
                  {showPasswords.new ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <div className={styles.passwordInputContainer}>
                <input
                  name="confirmPassword"
                  type={showPasswords.confirm ? "text" : "password"}
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  placeholder="Подтвердите новый пароль"
                  className={styles.input}
                  required
                />
                <button
                  type="button"
                  className={styles.eyeButton}
                  onClick={() => setShowPasswords(prev => ({ ...prev, confirm: !prev.confirm }))}
                >
                  {showPasswords.confirm ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>

              <div className={styles.passwordModalButtons}>
                <button type="submit" disabled={isLoading} className={styles.submitButton}>
                  {isLoading ? 'Изменение...' : 'Изменить пароль'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowChangePassword(false);
                    setPasswordData({
                      currentPassword: '',
                      newPassword: '',
                      confirmPassword: ''
                    });
                  }}
                  className={styles.cancelButton}
                >
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </PageLayout>
  );
}

export default SettingsPage;
