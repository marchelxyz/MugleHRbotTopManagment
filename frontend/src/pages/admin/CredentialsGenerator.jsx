// frontend/src/pages/admin/CredentialsGenerator.jsx

import React, { useState, useEffect } from 'react';
import { FaCopy, FaCheck, FaSearch, FaKey, FaPaperPlane } from 'react-icons/fa';
import { setUserCredentials, searchUsers, bulkSendCredentials } from '../../api';
import styles from '../AdminPage.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';
import { generateLoginFromName } from '../../utils/transliteration';

function CredentialsGenerator() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [mode, setMode] = useState('individual'); // 'individual' или 'bulk'
  
  // Состояния для индивидуальной установки
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState({ login: false, password: false });

  // Состояния для массовой рассылки
  const [bulkMessage, setBulkMessage] = useState('');
  const [includeActive, setIncludeActive] = useState(true);
  const [includeBlocked, setIncludeBlocked] = useState(true);
  const [regenerateExisting, setRegenerateExisting] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);

  // Генерация случайного пароля
  const generatePassword = () => {
    const length = 12;
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(password);
  };

  // Поиск пользователей
  const handleSearch = async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    setSearching(true);
    try {
      const response = await searchUsers(query);
      setSearchResults(response.data || []);
      setShowSearchResults(true);
    } catch (error) {
      console.error('Ошибка поиска:', error);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) {
        handleSearch(searchQuery);
      } else {
        setSearchResults([]);
        setShowSearchResults(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSelectUser = (user) => {
    setSelectedUser(user);
    setSearchQuery(`${user.first_name || ''} ${user.last_name || ''}`.trim());
    setShowSearchResults(false);
    setSearchResults([]);
    
    // Автоматически генерируем логин на основе имени и фамилии с транслитерацией
    if (user.first_name || user.last_name) {
      const generatedLogin = generateLoginFromName(user.first_name || '', user.last_name || '');
      if (generatedLogin) {
        setLogin(generatedLogin);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedUser) {
      showAlert('Выберите пользователя', 'error');
      return;
    }

    if (!login || login.length < 3) {
      showAlert('Логин должен содержать минимум 3 символа', 'error');
      return;
    }

    if (!password || password.length < 6) {
      showAlert('Пароль должен содержать минимум 6 символов', 'error');
      return;
    }

    setLoading(true);
    setGeneratedCredentials(null);

    try {
      const response = await setUserCredentials(selectedUser.id, {
        login: login.trim(),
        password: password
      });
      
      setGeneratedCredentials({
        login: response.data.login,
        password: password // Сохраняем пароль, так как он больше не будет показан
      });
      
      showAlert('Учетные данные успешно установлены!', 'success');
      
      // Очищаем форму
      setSelectedUser(null);
      setSearchQuery('');
      setLogin('');
      setPassword('');
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось установить учетные данные';
      showAlert(errorMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();

    if (!includeActive && !includeBlocked) {
      showAlert('Выберите хотя бы один тип пользователей (активные или заблокированные)', 'error');
      return;
    }

    const isConfirmed = await confirm(
      'Подтверждение массовой рассылки',
      `Вы уверены, что хотите отправить учетные данные всем выбранным пользователям?\n\n` +
      `Активные пользователи: ${includeActive ? 'Да' : 'Нет'}\n` +
      `Заблокированные пользователи: ${includeBlocked ? 'Да' : 'Нет'}\n` +
      `Перегенерировать существующие: ${regenerateExisting ? 'Да' : 'Нет'}\n\n` +
      `Это действие может занять некоторое время.`
    );

    if (!isConfirmed) return;

    setBulkLoading(true);
    setBulkResult(null);

    try {
      const response = await bulkSendCredentials({
        message: bulkMessage.trim(),
        include_active: includeActive,
        include_blocked: includeBlocked,
        regenerate_existing: regenerateExisting
      });

      setBulkResult(response.data);
      showAlert(
        `Рассылка завершена! Сгенерировано: ${response.data.credentials_generated}, отправлено: ${response.data.messages_sent}`,
        'success'
      );
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось выполнить массовую рассылку';
      showAlert(errorMsg, 'error');
    } finally {
      setBulkLoading(false);
    }
  };

  const copyToClipboard = async (text, type) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(prev => ({ ...prev, [type]: true }));
      setTimeout(() => {
        setCopied(prev => ({ ...prev, [type]: false }));
      }, 2000);
    } catch (error) {
      showAlert('Не удалось скопировать в буфер обмена', 'error');
    }
  };

  return (
    <div>
      <h2>Управление учетными данными сотрудников</h2>

      {/* Переключатель режимов */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <button
          onClick={() => {
            setMode('individual');
            setBulkResult(null);
            setGeneratedCredentials(null);
          }}
          className={mode === 'individual' ? styles.buttonGreen : styles.buttonGrey}
          style={{ flex: 1 }}
        >
          Индивидуальная установка
        </button>
        <button
          onClick={() => {
            setMode('bulk');
            setBulkResult(null);
            setGeneratedCredentials(null);
          }}
          className={mode === 'bulk' ? styles.buttonGreen : styles.buttonGrey}
          style={{ flex: 1 }}
        >
          Массовая рассылка
        </button>
      </div>

      {/* Индивидуальная установка */}
      {mode === 'individual' && (
        <>
          <div className={styles.card}>
            <form onSubmit={handleSubmit}>
              {/* Поиск пользователя */}
              <div style={{ marginBottom: '20px', position: 'relative' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Поиск сотрудника:
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      if (!e.target.value) {
                        setSelectedUser(null);
                      }
                    }}
                    placeholder="Введите имя или фамилию..."
                    className={styles.input}
                    style={{ paddingLeft: '40px' }}
                  />
                  <FaSearch 
                    style={{ 
                      position: 'absolute', 
                      left: '12px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      color: '#666'
                    }} 
                  />
                  {searching && (
                    <span style={{ 
                      position: 'absolute', 
                      right: '12px', 
                      top: '50%', 
                      transform: 'translateY(-50%)',
                      fontSize: '12px',
                      color: '#666'
                    }}>
                      Поиск...
                    </span>
                  )}
                </div>
                
                {/* Результаты поиска */}
                {showSearchResults && searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    marginTop: '4px',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                  }}>
                    {searchResults.map(user => (
                      <div
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        style={{
                          padding: '12px',
                          cursor: 'pointer',
                          borderBottom: '1px solid #eee',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                      >
                        <div>
                          <div style={{ fontWeight: 'bold' }}>
                            {user.first_name || ''} {user.last_name || ''}
                          </div>
                          <div style={{ fontSize: '12px', color: '#666' }}>
                            {user.position || ''} {user.department ? `• ${user.department}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Выбранный пользователь */}
                {selectedUser && (
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    backgroundColor: 'var(--theme-light)',
                    borderRadius: '8px',
                    border: '1px solid var(--theme-primary)'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                      Выбран: {selectedUser.first_name || ''} {selectedUser.last_name || ''}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {selectedUser.position || ''} {selectedUser.department ? `• ${selectedUser.department}` : ''}
                    </div>
                    {selectedUser.login && (
                      <div style={{ fontSize: '12px', color: '#ff9800', marginTop: '4px' }}>
                        ⚠️ У пользователя уже есть логин: {selectedUser.login}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Логин */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Логин: *
                </label>
                <input
                  type="text"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  placeholder="Введите логин (минимум 3 символа)"
                  className={styles.input}
                  required
                  minLength={3}
                />
              </div>

              {/* Пароль */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Пароль: *
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Введите пароль (минимум 6 символов)"
                    className={styles.input}
                    style={{ flex: 1 }}
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: '#4caf50',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      whiteSpace: 'nowrap'
                    }}
                    title="Сгенерировать случайный пароль"
                  >
                    <FaKey /> Сгенерировать
                  </button>
                </div>
              </div>
              
              <button 
                type="submit" 
                className={styles.buttonGreen}
                disabled={loading || !selectedUser}
              >
                {loading ? 'Установка...' : 'Установить учетные данные'}
              </button>
            </form>
          </div>

          {/* Показываем созданные учетные данные */}
          {generatedCredentials && (
            <div className={styles.card} style={{ marginTop: '20px', backgroundColor: 'var(--theme-light)', border: '2px solid var(--theme-primary)' }}>
              <h3 style={{ marginTop: 0, color: 'var(--theme-primary)' }}>Учетные данные установлены!</h3>
              <p style={{ marginBottom: '15px', color: '#666' }}>
                Сохраните эти данные. Пароль больше не будет показан.
              </p>
              
              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Логин:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="text"
                    value={generatedCredentials.login}
                    readOnly
                    className={styles.input}
                    style={{ flex: 1, backgroundColor: '#fff' }}
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedCredentials.login, 'login')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: copied.login ? '#4caf50' : 'var(--theme-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {copied.login ? <FaCheck /> : <FaCopy />}
                    {copied.login ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Пароль:</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="text"
                    value={generatedCredentials.password}
                    readOnly
                    className={styles.input}
                    style={{ flex: 1, backgroundColor: '#fff' }}
                  />
                  <button
                    type="button"
                    onClick={() => copyToClipboard(generatedCredentials.password, 'password')}
                    style={{
                      padding: '10px 15px',
                      backgroundColor: copied.password ? '#4caf50' : 'var(--theme-primary)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px'
                    }}
                  >
                    {copied.password ? <FaCheck /> : <FaCopy />}
                    {copied.password ? 'Скопировано' : 'Копировать'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Массовая рассылка */}
      {mode === 'bulk' && (
        <>
          <div className={styles.card}>
            <form onSubmit={handleBulkSubmit}>
              <h3 style={{ marginTop: 0, marginBottom: '20px' }}>Массовая рассылка учетных данных</h3>

              {/* Текстовое сообщение */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
                  Текстовое сообщение (опционально):
                </label>
                <textarea
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="Введите текст сообщения, которое будет добавлено к рассылке учетных данных..."
                  className={styles.input}
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  rows={4}
                />
                <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                  Это сообщение будет добавлено перед логином и паролем в каждом сообщении.
                </div>
              </div>

              {/* Настройки рассылки */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold' }}>
                  Выберите пользователей для рассылки:
                </label>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeActive}
                      onChange={(e) => setIncludeActive(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Включить активных пользователей</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={includeBlocked}
                      onChange={(e) => setIncludeBlocked(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Включить заблокированных пользователей</span>
                  </label>
                  
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={regenerateExisting}
                      onChange={(e) => setRegenerateExisting(e.target.checked)}
                      style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                    />
                    <span>Перегенерировать для пользователей с существующими учетными данными</span>
                  </label>
                </div>
              </div>

              <div style={{ 
                padding: '15px', 
                backgroundColor: '#fff3cd', 
                borderRadius: '8px', 
                marginBottom: '20px',
                border: '1px solid #ffc107'
              }}>
                <div style={{ fontWeight: 'bold', marginBottom: '5px', color: '#856404' }}>
                  ⚠️ Важно:
                </div>
                <div style={{ fontSize: '14px', color: '#856404' }}>
                  • Учетные данные будут автоматически сгенерированы для каждого пользователя<br/>
                  • Логин создается на основе имени и фамилии<br/>
                  • Пароль генерируется случайным образом<br/>
                  • Сообщения будут отправлены через Telegram<br/>
                  • Пользователи без Telegram ID будут пропущены
                </div>
              </div>
              
              <button 
                type="submit" 
                className={styles.buttonGreen}
                disabled={bulkLoading || (!includeActive && !includeBlocked)}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}
              >
                <FaPaperPlane />
                {bulkLoading ? 'Отправка...' : 'Отправить массовую рассылку'}
              </button>
            </form>
          </div>

          {/* Результаты массовой рассылки */}
          {bulkResult && (
            <div className={styles.card} style={{ marginTop: '20px', backgroundColor: 'var(--theme-light)', border: '2px solid var(--theme-primary)' }}>
              <h3 style={{ marginTop: 0, color: 'var(--theme-primary)' }}>Результаты рассылки</h3>
              
              <div style={{ marginBottom: '15px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Всего пользователей найдено:</strong> {bulkResult.total_users}
                </div>
                <div style={{ marginBottom: '8px', color: '#4caf50' }}>
                  <strong>✓ Учетных данных сгенерировано:</strong> {bulkResult.credentials_generated}
                </div>
                <div style={{ marginBottom: '8px', color: 'var(--theme-primary)' }}>
                  <strong>📨 Сообщений отправлено:</strong> {bulkResult.messages_sent}
                </div>
                {bulkResult.failed_users && bulkResult.failed_users.length > 0 && (
                  <div style={{ marginTop: '15px', color: '#f44336' }}>
                    <strong>❌ Ошибки при отправке (ID пользователей):</strong>
                    <div style={{ marginTop: '5px', fontSize: '12px' }}>
                      {bulkResult.failed_users.join(', ')}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default CredentialsGenerator;
