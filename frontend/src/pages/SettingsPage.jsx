// frontend/src/pages/SettingsPage.jsx

import React, { useState, useEffect } from 'react';
import styles from './SettingsPage.module.css';
import { FaQuestionCircle, FaHeadset, FaFileContract, FaBookOpen, FaSignOutAlt, FaKey, FaEye, FaEyeSlash } from 'react-icons/fa';
import PageLayout from '../components/PageLayout';
import { isTelegramMode, clearAuth, getUser } from '../utils/auth';
import { updateMyCredentials } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';

function SettingsPage({ onBack, onNavigate, onRepeatOnboarding }) {

  // Ссылка на ваш аккаунт поддержки в Telegram
  const supportUrl = 'https://t.me/fix2Form'; // <-- НЕ ЗАБУДЬТЕ ЗАМЕНИТЬ НА ВАШ АККАУНТ
  
  const telegramMode = isTelegramMode();
  const { showAlert } = useModalAlert();
  
  // Состояния для формы изменения учетных данных
  const [showCredentialsForm, setShowCredentialsForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newLogin, setNewLogin] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  
  useEffect(() => {
    // Получаем данные текущего пользователя из localStorage
    const user = getUser();
    setCurrentUser(user);
    if (user && user.login) {
      setNewLogin(user.login);
    }
  }, []);
  
  const handleLogout = () => {
    if (window.confirm('Вы уверены, что хотите выйти?')) {
      clearAuth();
      window.location.reload();
    }
  };

  const handleCredentialsSubmit = async (e) => {
    e.preventDefault();
    
    if (!currentPassword) {
      showAlert('Введите текущий пароль', 'error');
      return;
    }
    
    if (!newLogin && !newPassword) {
      showAlert('Введите новый логин или пароль', 'error');
      return;
    }
    
    if (newLogin && newLogin.length < 3) {
      showAlert('Логин должен содержать минимум 3 символа', 'error');
      return;
    }
    
    if (newPassword && newPassword.length < 6) {
      showAlert('Пароль должен содержать минимум 6 символов', 'error');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await updateMyCredentials({
        current_password: currentPassword,
        new_login: newLogin || null,
        new_password: newPassword || null
      });
      
      showAlert('Учетные данные успешно обновлены!', 'success');
      
      // Обновляем данные пользователя в localStorage
      const user = getUser();
      if (user && response.data.login) {
        user.login = response.data.login;
        localStorage.setItem('auth_user', JSON.stringify(user));
        setCurrentUser(user);
        setNewLogin(response.data.login);
      }
      
      // Очищаем форму
      setCurrentPassword('');
      setNewPassword('');
      setShowCredentialsForm(false);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось изменить учетные данные';
      showAlert(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Показываем форму только для веб-версии и если у пользователя есть логин (браузерная аутентификация)
  const showCredentialsSection = !telegramMode && currentUser && currentUser.login;

  return (
    // 1. Используем PageLayout с названием "Настройки", которое отобразится в шапке
    <PageLayout title="Настройки">
      
      {/* 2. Кнопка "Назад" теперь стилизована и расположена вверху контента */}
      <button onClick={onBack} className={styles.backButton}>
        &larr; Назад в профиль
      </button>

      {/* Форма изменения учетных данных (только для веб-версии) */}
      {showCredentialsSection && (
        <div className={styles.card} style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <FaKey />
              Учетные данные для входа
            </h3>
            <button
              onClick={() => {
                setShowCredentialsForm(!showCredentialsForm);
                if (!showCredentialsForm) {
                  // Сбрасываем форму при открытии
                  setCurrentPassword('');
                  setNewPassword('');
                }
              }}
              className={styles.buttonSmall}
              style={{ padding: '8px 16px' }}
            >
              {showCredentialsForm ? 'Скрыть' : 'Изменить'}
            </button>
          </div>
          
          {currentUser.login && (
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '8px' }}>
              <div style={{ fontSize: '14px', color: '#666' }}>Текущий логин:</div>
              <div style={{ fontSize: '16px', fontWeight: 'bold', marginTop: '5px' }}>{currentUser.login}</div>
            </div>
          )}
          
          {showCredentialsForm && (
            <form onSubmit={handleCredentialsSubmit}>
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Текущий пароль: *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Введите текущий пароль"
                    className={styles.input}
                    required
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#666',
                      padding: '5px'
                    }}
                  >
                    {showCurrentPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Новый логин (оставьте пустым, чтобы не менять):
                </label>
                <input
                  type="text"
                  value={newLogin}
                  onChange={(e) => setNewLogin(e.target.value)}
                  placeholder="Введите новый логин (минимум 3 символа)"
                  className={styles.input}
                  minLength={3}
                />
              </div>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', fontSize: '14px' }}>
                  Новый пароль (оставьте пустым, чтобы не менять):
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Введите новый пароль (минимум 6 символов)"
                    className={styles.input}
                    minLength={6}
                    style={{ paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#666',
                      padding: '5px'
                    }}
                  >
                    {showNewPassword ? <FaEyeSlash /> : <FaEye />}
                  </button>
                </div>
              </div>
              
              <div style={{ 
                padding: '10px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '8px', 
                marginBottom: '15px',
                fontSize: '12px',
                color: '#856404'
              }}>
                ⚠️ Для изменения учетных данных необходимо указать текущий пароль и хотя бы один новый параметр (логин или пароль).
              </div>
              
              <button
                type="submit"
                className={styles.buttonGreen}
                disabled={loading}
                style={{ width: '100%' }}
              >
                {loading ? 'Сохранение...' : 'Сохранить изменения'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* 3. Основной список опций */}
      <div className={styles.settingsList}>

        {/* 3. Добавляем новую кнопку */}
        <button onClick={onRepeatOnboarding} className={styles.settingsItem}>
          <FaBookOpen className={styles.icon} />
          <span>Пройти обучение повторно</span>
        </button>
        
        {/* Кнопка FAQ */}
        <button onClick={() => onNavigate('faq')} className={styles.settingsItem}>
          <FaQuestionCircle className={styles.icon} />
          <span>Часто задаваемые вопросы (FAQ)</span>
        </button>

        {/* Ссылка на поддержку */}
        <a href={supportUrl} target="_blank" rel="noopener noreferrer" className={styles.settingsItem}>
          <FaHeadset className={styles.icon} />
          <span>Поддержка</span>
        </a>

        {/* Неактивная кнопка */}
        <div className={styles.settingsItemDisabled}>
          <FaFileContract className={styles.icon} />
          <span>Юридическая документация</span>
        </div>

        {/* Кнопка выхода (только для браузерного режима) */}
        {!telegramMode && (
          <button onClick={handleLogout} className={`${styles.settingsItem} ${styles.logoutButton}`}>
            <FaSignOutAlt className={styles.icon} />
            <span>Выйти</span>
          </button>
        )}

      </div>
    </PageLayout>
  );
}

export default SettingsPage;
