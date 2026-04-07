// frontend/src/pages/admin/EmailBroadcast.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { FaEnvelope, FaSync } from 'react-icons/fa';
import { getBroadcastEmailPreview, broadcastEmail } from '../../api';
import styles from '../AdminPage.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

const DEFAULT_BODY_SUGGESTION =
  'Здравствуйте!\n\nУ приложения новая ссылка для входа. Пожалуйста, переходите по ней при работе в браузере.\n\nС уважением, администрация.';

function EmailBroadcast() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [subject, setSubject] = useState('Новая ссылка для входа в приложение');
  const [body, setBody] = useState('');
  const [onlyBrowserUsers, setOnlyBrowserUsers] = useState(true);
  const [appendLoginUrl, setAppendLoginUrl] = useState(true);
  const [recipientCount, setRecipientCount] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const response = await getBroadcastEmailPreview(onlyBrowserUsers);
      setRecipientCount(response.data.recipient_count);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось получить число получателей';
      showAlert(errorMsg, 'error');
      setRecipientCount(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [onlyBrowserUsers, showAlert]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  async function handleSubmit(e) {
    e.preventDefault();
    const sub = subject.trim();
    const text = body.trim();
    if (!sub) {
      showAlert('Укажите тему письма', 'error');
      return;
    }
    if (!text) {
      showAlert('Введите текст сообщения', 'error');
      return;
    }

    const countLabel = recipientCount != null ? String(recipientCount) : 'неизвестно';
    const isConfirmed = await confirm(
      'Подтверждение рассылки',
      `Будет отправлено письмо на email пользователям с обычным доступом (одобрены, не заблокированы).\n\n` +
        `Ориентировочно получателей: ${countLabel}.\n\n` +
        `Тема: ${sub}\n\nПродолжить?`
    );
    if (!isConfirmed) return;

    setSending(true);
    try {
      const response = await broadcastEmail({
        subject: sub,
        body: text,
        only_browser_users: onlyBrowserUsers,
        append_login_url: appendLoginUrl,
      });
      const data = response.data;
      const failedCount = data.failed?.length ?? 0;
      if (data.sent_ok === 0) {
        showAlert(
          failedCount
            ? `${data.message}. Проверьте SMTP и адреса получателей.`
            : 'Нет получателей или не удалось отправить письма.',
          'error'
        );
      } else if (failedCount > 0) {
        showAlert(`${data.message}. Не доставлено: ${failedCount}.`, 'error');
        console.warn('Broadcast email failures', data.failed);
      } else {
        showAlert(data.message, 'success');
      }
      await loadPreview();
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось выполнить рассылку';
      showAlert(errorMsg, 'error');
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <h2>
        <FaEnvelope style={{ marginRight: '8px', verticalAlign: 'middle' }} />
        Рассылка на email
      </h2>
      <p style={{ color: '#555', marginBottom: '20px', lineHeight: 1.5 }}>
        Письма уходят на адреса, указанные у пользователей в профиле. Учитываются только одобренные
        аккаунты, не заблокированные. По умолчанию — только те, у кого включён вход через браузер
        (обычный доступ к веб-приложению). Нужен настроенный SMTP на сервере.
      </p>

      <div className={styles.card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontWeight: 'bold' }}>Получателей (оценка):</span>
          <span>
            {previewLoading ? '…' : recipientCount != null ? recipientCount : '—'}
          </span>
          <button
            type="button"
            onClick={loadPreview}
            disabled={previewLoading}
            className={styles.buttonGrey}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <FaSync size={14} />
            Обновить
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>Тема</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={styles.input}
            maxLength={200}
            placeholder="Краткая тема письма"
          />

          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', marginTop: '12px' }}>
            Текст письма
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className={styles.textarea}
            rows={10}
            placeholder={DEFAULT_BODY_SUGGESTION}
          />
          <button
            type="button"
            className={styles.buttonGrey}
            style={{ marginBottom: '16px' }}
            onClick={() => setBody(DEFAULT_BODY_SUGGESTION)}
          >
            Подставить пример текста
          </button>

          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={onlyBrowserUsers}
              onChange={(e) => setOnlyBrowserUsers(e.target.checked)}
            />
            Только пользователи с доступом через браузер (рекомендуется для ссылки на вход)
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={appendLoginUrl}
              onChange={(e) => setAppendLoginUrl(e.target.checked)}
            />
            Добавить в письмо ссылку для входа из настройки WEB_APP_LOGIN_URL на сервере
          </label>

          <button type="submit" disabled={sending} className={styles.buttonGreen} style={{ marginTop: '16px' }}>
            {sending ? 'Отправка…' : 'Отправить рассылку'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default EmailBroadcast;
