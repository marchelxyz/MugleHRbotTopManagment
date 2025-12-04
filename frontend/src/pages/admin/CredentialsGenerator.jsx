// frontend/src/pages/admin/CredentialsGenerator.jsx

import React, { useState } from 'react';
import { FaCopy, FaCheck } from 'react-icons/fa';
import { adminGenerateCredentials } from '../../api';
import styles from '../AdminPage.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';

function CredentialsGenerator() {
  const { showAlert } = useModalAlert();
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    department: '',
    position: '',
  });
  const [generatedCredentials, setGeneratedCredentials] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState({ login: false, password: false });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setGeneratedCredentials(null);

    try {
      const response = await adminGenerateCredentials(formData);
      setGeneratedCredentials(response.data);
      showAlert('Учетные данные успешно сгенерированы!', 'success');
      // Очищаем форму после успешной генерации
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        department: '',
        position: '',
      });
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось сгенерировать учетные данные';
      showAlert(errorMsg, 'error');
    } finally {
      setLoading(false);
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
      <h2>Генерация учетных данных</h2>
      
      <div className={styles.card}>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
            <input
              name="first_name"
              value={formData.first_name}
              onChange={handleChange}
              placeholder="Имя *"
              className={styles.input}
              required
            />
            <input
              name="last_name"
              value={formData.last_name}
              onChange={handleChange}
              placeholder="Фамилия *"
              className={styles.input}
              required
            />
            <input
              name="email"
              type="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email *"
              className={styles.input}
              required
            />
            <input
              name="department"
              value={formData.department}
              onChange={handleChange}
              placeholder="Подразделение"
              className={styles.input}
            />
            <input
              name="position"
              value={formData.position}
              onChange={handleChange}
              placeholder="Должность"
              className={styles.input}
            />
          </div>
          
          <button 
            type="submit" 
            className={styles.buttonGreen}
            disabled={loading}
          >
            {loading ? 'Генерация...' : 'Сгенерировать учетные данные'}
          </button>
        </form>
      </div>

      {generatedCredentials && (
        <div className={styles.card} style={{ marginTop: '20px', backgroundColor: '#f0f9ff', border: '2px solid #2196F3' }}>
          <h3 style={{ marginTop: 0, color: '#2196F3' }}>Учетные данные созданы!</h3>
          <p style={{ marginBottom: '15px', color: '#666' }}>
            Сохраните эти данные. Они больше не будут показаны.
          </p>
          
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Логин:</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input
                type="text"
                value={generatedCredentials.login || generatedCredentials.username || ''}
                readOnly
                className={styles.input}
                style={{ flex: 1, backgroundColor: '#fff' }}
              />
              <button
                type="button"
                onClick={() => copyToClipboard(generatedCredentials.login || generatedCredentials.username, 'login')}
                style={{
                  padding: '10px 15px',
                  backgroundColor: copied.login ? '#4caf50' : '#2196F3',
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
                value={generatedCredentials.password || ''}
                readOnly
                className={styles.input}
                style={{ flex: 1, backgroundColor: '#fff' }}
              />
              <button
                type="button"
                onClick={() => copyToClipboard(generatedCredentials.password, 'password')}
                style={{
                  padding: '10px 15px',
                  backgroundColor: copied.password ? '#4caf50' : '#2196F3',
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
    </div>
  );
}

export default CredentialsGenerator;
