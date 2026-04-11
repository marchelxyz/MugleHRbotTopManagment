import React, { useState } from 'react';
import { loginAdminPanel } from '../api';
import styles from '../pages/LoginPage.module.css';

/**
 * Форма входа в админ-панель по email из ADMIN_EMAILS и ADMIN_PANEL_PASSWORD на сервере.
 */
export default function AdminPanelLoginSection({ onSuccess, showAlert }) {
  const [expanded, setExpanded] = useState(false);
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.email.trim() || !form.password) {
      showAlert('Введите email и пароль администратора.', 'error');
      return;
    }
    setLoading(true);
    try {
      const response = await loginAdminPanel(form.email.trim(), form.password);
      const { access_token: accessToken, user } = response.data;
      showAlert('Вход в админ-панель выполнен.', 'success');
      setTimeout(() => {
        if (onSuccess) {
          onSuccess(user, accessToken);
        }
      }, 400);
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg =
        typeof detail === 'string'
          ? detail
          : 'Не удалось войти. Проверьте email и пароль панели.';
      showAlert(msg, 'error');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.adminPanelSection}>
      <button
        type="button"
        className={styles.linkButton}
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? 'Скрыть вход администратора' : 'Вход администратора'}
      </button>
      {expanded && (
        <form onSubmit={handleSubmit} className={styles.form}>
          <p className={styles.adminHint}>
            Служебный email из списка администраторов на сервере и пароль панели
            (переменные окружения).
          </p>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            placeholder="Email администратора"
            className={styles.input}
            autoComplete="username"
          />
          <input
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            placeholder="Пароль админ-панели"
            className={styles.input}
            autoComplete="current-password"
          />
          <button type="submit" disabled={loading} className={styles.submitButton}>
            {loading ? 'Вход…' : 'Войти в админ-панель'}
          </button>
        </form>
      )}
    </div>
  );
}
