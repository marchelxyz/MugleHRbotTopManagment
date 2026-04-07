// frontend/src/pages/admin/EmailBroadcast.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { FaEnvelope, FaSync, FaPaperPlane } from 'react-icons/fa';
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
  const [sendEmail, setSendEmail] = useState(true);
  const [sendTelegram, setSendTelegram] = useState(false);
  const [recipientCountEmail, setRecipientCountEmail] = useState(null);
  const [recipientCountTelegram, setRecipientCountTelegram] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const response = await getBroadcastEmailPreview(onlyBrowserUsers);
      setRecipientCountEmail(response.data.recipient_count_email);
      setRecipientCountTelegram(response.data.recipient_count_telegram);
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Не удалось получить число получателей';
      showAlert(errorMsg, 'error');
      setRecipientCountEmail(null);
      setRecipientCountTelegram(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [onlyBrowserUsers, showAlert]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!sendEmail && !sendTelegram) {
      showAlert('Выберите хотя бы один канал: email или Telegram', 'error');
      return;
    }
    const sub = subject.trim();
    const text = body.trim();
    if (!sub) {
      showAlert('Укажите тему сообщения', 'error');
      return;
    }
    if (!text) {
      showAlert('Введите текст сообщения', 'error');
      return;
    }

    const emailPart =
      sendEmail && recipientCountEmail != null
        ? `Email: ориентировочно ${recipientCountEmail} адрес(ов)`
        : sendEmail
          ? 'Email: да'
          : null;
    const tgPart =
      sendTelegram && recipientCountTelegram != null
        ? `Telegram: ориентировочно ${recipientCountTelegram} чат(ов)`
        : sendTelegram
          ? 'Telegram: да'
          : null;
    const channelsHint = [emailPart, tgPart].filter(Boolean).join('\n');

    const isConfirmed = await confirm(
      'Подтверждение рассылки',
      `Каналы:\n${channelsHint}\n\nТема: ${sub}\n\nПродолжить?`
    );
    if (!isConfirmed) return;

    setSending(true);
    try {
      const response = await broadcastEmail({
        subject: sub,
        body: text,
        only_browser_users: onlyBrowserUsers,
        append_login_url: appendLoginUrl,
        send_email: sendEmail,
        send_telegram: sendTelegram,
      });
      const data = response.data;
      const failedCount = data.failed?.length ?? 0;
      const totalOk = (data.sent_ok_email ?? 0) + (data.sent_ok_telegram ?? 0);
      if (totalOk === 0) {
        showAlert(
          failedCount
            ? `${data.message}. Проверьте SMTP, Telegram и список получателей.`
            : 'Нет получателей или не удалось отправить сообщения.',
          'error'
        );
      } else if (failedCount > 0) {
        showAlert(`${data.message}. Ошибок доставки: ${failedCount}.`, 'error');
        console.warn('Broadcast failures', data.failed);
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
        Рассылка (email и Telegram)
      </h2>
      <p style={{ color: '#555', marginBottom: '20px', lineHeight: 1.5 }}>
        Учитываются только одобренные аккаунты, не заблокированные. По умолчанию — пользователи с
        включённым входом через браузер. Для email нужен SMTP на сервере; для Telegram — настроенный
        бот (TELEGRAM_BOT_TOKEN). Можно отправить только в один канал или сразу в оба.
      </p>

      <div className={styles.card}>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 'bold' }}>Оценка получателей:</span>
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
          <div style={{ color: '#444', fontSize: '15px' }}>
            {previewLoading ? (
              '…'
            ) : (
              <>
                <FaPaperPlane style={{ marginRight: '6px', opacity: 0.7 }} />
                Email: {recipientCountEmail != null ? recipientCountEmail : '—'} · Telegram:{' '}
                {recipientCountTelegram != null ? recipientCountTelegram : '—'}
              </>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
            Каналы доставки
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Отправить на email (пользователям с валидным адресом в профиле)
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={sendTelegram}
              onChange={(e) => setSendTelegram(e.target.checked)}
            />
            Отправить в Telegram (пользователям с привязанным Telegram)
          </label>

          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', marginTop: '16px' }}>
            Тема
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={styles.input}
            maxLength={200}
            placeholder="Краткая тема (в письме и как заголовок в Telegram)"
          />

          <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', marginTop: '12px' }}>
            Текст сообщения
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
            Добавить ссылку для входа (WEB_APP_LOGIN_URL) — в письме и в Telegram
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
