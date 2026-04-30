// frontend/src/pages/admin/EmailBroadcast.jsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FaEnvelope,
  FaSync,
  FaPaperPlane,
  FaCheckCircle,
  FaTimesCircle,
  FaExclamationTriangle,
  FaSearch,
  FaUserCheck,
  FaUserSlash,
  FaFileExcel,
} from 'react-icons/fa';
import {
  getBroadcastEmailPreview,
  getBroadcastEligibleUsers,
  broadcastEmail,
  exportBroadcastReport,
} from '../../api';
import styles from '../AdminPage.module.css';
import { useModalAlert } from '../../contexts/ModalAlertContext';
import { useConfirmation } from '../../contexts/ConfirmationContext';

const DEFAULT_BODY_SUGGESTION =
  'Здравствуйте!\n\nУ приложения новая ссылка для входа. Пожалуйста, переходите по ней при работе в браузере.\n\nС уважением, администрация.';

const ERROR_HINTS = {
  blocked: 'Пользователь заблокировал бота — попросите разблокировать.',
  deactivated: 'Аккаунт Telegram удалён или заморожен.',
  not_found: 'Чат с пользователем не найден (некорректный telegram_id).',
  no_dialog: 'Бот не может первым написать — пользователь не нажимал /start.',
  no_bot_dialog:
    'Не нажимал /start у бота — Telegram запрещает боту первое сообщение.',
  topic: 'Тема (топик) в админ-чате удалена или закрыта.',
  parse: 'Ошибка форматирования сообщения (HTML/Markdown).',
  rate_limit: 'Telegram временно ограничил частоту отправки (повторите позже).',
  timeout: 'Таймаут соединения с серверами Telegram.',
  network: 'Сетевая ошибка при обращении к Telegram.',
  smtp_error: 'SMTP отверг письмо — проверьте логин/пароль и хост.',
  smtp_auth: 'Ошибка аутентификации SMTP (логин или пароль).',
  smtp_connect: 'Не удалось подключиться к SMTP-серверу.',
  smtp_recipient: 'Адресат отверг письмо (несуществующий ящик).',
  invalid_email: 'Невалидный email-адрес в профиле пользователя.',
  exception: 'Внутренний сбой при отправке.',
  other: 'Не удалось доставить.',
};

const sectionHeader = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: '12px',
  marginTop: '20px',
  marginBottom: '8px',
};

const tableStyles = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '14px',
};

const cellStyles = {
  padding: '8px 6px',
  borderBottom: '1px solid #eee',
  verticalAlign: 'top',
};

const RecipientRow = React.memo(function RecipientRow({
  user,
  selected,
  onToggle,
  channels,
  onChannelToggle,
}) {
  const fullName =
    `${user.last_name || ''} ${user.first_name || ''}`.trim() || `id:${user.id}`;
  return (
    <tr style={selected ? { background: '#f8fbff' } : undefined}>
      <td style={cellStyles}>
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggle(user.id, e.target.checked)}
        />
      </td>
      <td style={cellStyles}>
        <div style={{ fontWeight: 600 }}>{fullName}</div>
        <div style={{ fontSize: '12px', color: '#777' }}>
          {user.department || '—'}
          {user.position ? ` · ${user.position}` : ''}
        </div>
      </td>
      <td style={cellStyles}>
        {user.email_available ? (
          <span style={{ color: '#2e7d32' }}>{user.email}</span>
        ) : (
          <span style={{ color: '#a00' }}>{user.email || '—'}</span>
        )}
      </td>
      <td style={cellStyles}>
        {user.telegram_available ? (
          <span style={{ color: '#2e7d32' }}>
            <FaUserCheck style={{ marginRight: 4 }} />
            id {user.telegram_id}
          </span>
        ) : user.telegram_no_dialog ? (
          <span style={{ color: '#b27600' }} title={ERROR_HINTS.no_bot_dialog}>
            <FaExclamationTriangle style={{ marginRight: 4 }} />
            нет /start
          </span>
        ) : (
          <span style={{ color: '#777' }}>
            <FaUserSlash style={{ marginRight: 4 }} />—
          </span>
        )}
      </td>
      <td style={cellStyles}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            opacity: user.email_available ? 1 : 0.4,
          }}
        >
          <input
            type="checkbox"
            disabled={!user.email_available || !selected}
            checked={selected && channels.email}
            onChange={(e) => onChannelToggle(user.id, 'email', e.target.checked)}
          />
          email
        </label>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            marginLeft: 12,
            opacity: user.telegram_available ? 1 : 0.4,
          }}
        >
          <input
            type="checkbox"
            disabled={!user.telegram_available || !selected}
            checked={selected && channels.telegram}
            onChange={(e) => onChannelToggle(user.id, 'telegram', e.target.checked)}
          />
          tg
        </label>
      </td>
    </tr>
  );
});

function EmailBroadcast() {
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();
  const [subject, setSubject] = useState('Новая ссылка для входа в приложение');
  const [body, setBody] = useState('');
  const [onlyBrowserUsers, setOnlyBrowserUsers] = useState(true);
  const [appendLoginUrl, setAppendLoginUrl] = useState(true);
  const [recipientCountEmail, setRecipientCountEmail] = useState(null);
  const [recipientCountTelegram, setRecipientCountTelegram] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Список кандидатов и выбор
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [eligibleLoading, setEligibleLoading] = useState(false);
  const [search, setSearch] = useState('');
  // selection: { [userId]: { email: bool, telegram: bool } }
  const [selection, setSelection] = useState({});
  const [allUsersMode, setAllUsersMode] = useState(true);
  // Отчёт после рассылки
  const [report, setReport] = useState(null);

  const loadPreview = useCallback(async () => {
    setPreviewLoading(true);
    try {
      const response = await getBroadcastEmailPreview(onlyBrowserUsers);
      setRecipientCountEmail(response.data.recipient_count_email);
      setRecipientCountTelegram(response.data.recipient_count_telegram);
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail || 'Не удалось получить число получателей';
      showAlert(errorMsg, 'error');
      setRecipientCountEmail(null);
      setRecipientCountTelegram(null);
    } finally {
      setPreviewLoading(false);
    }
  }, [onlyBrowserUsers, showAlert]);

  const loadEligible = useCallback(async () => {
    setEligibleLoading(true);
    try {
      const response = await getBroadcastEligibleUsers(onlyBrowserUsers);
      setEligibleUsers(response.data.users || []);
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail || 'Не удалось загрузить список пользователей';
      showAlert(errorMsg, 'error');
      setEligibleUsers([]);
    } finally {
      setEligibleLoading(false);
    }
  }, [onlyBrowserUsers, showAlert]);

  useEffect(() => {
    loadPreview();
    loadEligible();
  }, [loadPreview, loadEligible]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return eligibleUsers;
    return eligibleUsers.filter((u) => {
      const hay = [
        u.first_name,
        u.last_name,
        u.email,
        u.department,
        u.position,
        String(u.telegram_id ?? ''),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [eligibleUsers, search]);

  const eligibleStats = useMemo(() => {
    const total = eligibleUsers.length;
    const emailAvailable = eligibleUsers.filter((u) => u.email_available).length;
    const telegramAvailable = eligibleUsers.filter((u) => u.telegram_available).length;
    const telegramWithId = eligibleUsers.filter((u) => u.telegram_id != null).length;
    const telegramNoId = total - telegramWithId;
    const telegramNoStartMark = eligibleUsers.filter((u) => u.telegram_no_dialog).length;
    return {
      total,
      emailAvailable,
      telegramAvailable,
      telegramNoStartMark,
      telegramNoId,
    };
  }, [eligibleUsers]);

  const hiddenTelegramCount = eligibleStats.telegramNoId;

  const noStartUsers = useMemo(
    () =>
      eligibleUsers
        .filter((u) => u.telegram_no_dialog)
        .sort((a, b) =>
          `${a.last_name || ''} ${a.first_name || ''}`.localeCompare(
            `${b.last_name || ''} ${b.first_name || ''}`,
            'ru',
          ),
        ),
    [eligibleUsers],
  );

  const setUserSelected = (userId, selected) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (selected) {
        const u = eligibleUsers.find((x) => x.id === userId);
        next[userId] = {
          email: !!u?.email_available,
          telegram: !!u?.telegram_available,
        };
      } else {
        delete next[userId];
      }
      return next;
    });
  };

  const setUserChannel = (userId, channel, value) => {
    setSelection((prev) => {
      const next = { ...prev };
      if (!next[userId]) {
        next[userId] = { email: false, telegram: false };
      }
      next[userId] = { ...next[userId], [channel]: value };
      return next;
    });
  };

  const selectAllVisible = (channelMode = 'auto') => {
    setSelection((prev) => {
      const next = { ...prev };
      for (const u of filteredUsers) {
        const emailFlag =
          channelMode === 'email'
            ? !!u.email_available
            : channelMode === 'telegram'
              ? false
              : !!u.email_available;
        const tgFlag =
          channelMode === 'telegram'
            ? !!u.telegram_available
            : channelMode === 'email'
              ? false
              : !!u.telegram_available;
        if (emailFlag || tgFlag) {
          next[u.id] = { email: emailFlag, telegram: tgFlag };
        }
      }
      return next;
    });
  };

  const clearSelection = () => setSelection({});

  const selectedSummary = useMemo(() => {
    let email = 0;
    let telegram = 0;
    const ids = [];
    for (const [uid, ch] of Object.entries(selection)) {
      if (ch.email) email += 1;
      if (ch.telegram) telegram += 1;
      if (ch.email || ch.telegram) ids.push(Number(uid));
    }
    return { email, telegram, ids };
  }, [selection]);

  async function handleSubmit(e) {
    e.preventDefault();
    setReport(null);
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

    let payload;
    if (allUsersMode) {
      payload = {
        subject: sub,
        body: text,
        only_browser_users: onlyBrowserUsers,
        append_login_url: appendLoginUrl,
        send_email: true,
        send_telegram: false, // пусть админ сознательно отправит и в телеграм при «всем»
      };
      // В режиме «всем» добавим и Telegram, если в превью есть получатели и админ подтвердит
      const wantTelegram =
        recipientCountTelegram &&
        recipientCountTelegram > 0 &&
        (await confirm(
          'Также отправить в Telegram?',
          `В Telegram: ориентировочно ${recipientCountTelegram} чат(ов).\n\nОтправить и туда тоже?`,
        ));
      if (wantTelegram) payload.send_telegram = true;
    } else {
      if (selectedSummary.ids.length === 0) {
        showAlert('Выберите хотя бы одного получателя', 'error');
        return;
      }
      if (selectedSummary.email === 0 && selectedSummary.telegram === 0) {
        showAlert('Включите хотя бы один канал у выбранных пользователей', 'error');
        return;
      }
      payload = {
        subject: sub,
        body: text,
        only_browser_users: onlyBrowserUsers,
        append_login_url: appendLoginUrl,
        send_email: selectedSummary.email > 0,
        send_telegram: selectedSummary.telegram > 0,
        user_ids: selectedSummary.ids,
      };
    }

    const summaryParts = [];
    if (payload.send_email) {
      const cnt = allUsersMode
        ? (recipientCountEmail ?? '—')
        : selectedSummary.email;
      summaryParts.push(`Email: ${cnt} адрес(ов)`);
    }
    if (payload.send_telegram) {
      const cnt = allUsersMode
        ? (recipientCountTelegram ?? '—')
        : selectedSummary.telegram;
      summaryParts.push(`Telegram: ${cnt} чат(ов)`);
    }
    const isConfirmed = await confirm(
      'Подтверждение рассылки',
      `Каналы:\n${summaryParts.join('\n')}\n\nТема: ${sub}\n\nПродолжить?`,
    );
    if (!isConfirmed) return;

    setSending(true);
    try {
      const response = await broadcastEmail(payload);
      const data = response.data;
      setReport({ ...data, subject: sub, sent_at: new Date().toISOString() });
      const failedCount = data.failed?.length ?? 0;
      const totalOk = (data.sent_ok_email ?? 0) + (data.sent_ok_telegram ?? 0);
      if (totalOk === 0) {
        showAlert(
          failedCount
            ? `${data.message}. Проверьте отчёт ниже.`
            : 'Нет получателей или не удалось отправить сообщения.',
          'error',
        );
      } else if (failedCount > 0) {
        showAlert(`${data.message}. Ошибок доставки: ${failedCount}.`, 'error');
      } else {
        showAlert(data.message, 'success');
      }
      await loadPreview();
    } catch (error) {
      const errorMsg =
        error.response?.data?.detail || 'Не удалось выполнить рассылку';
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
        Учитываются только одобренные аккаунты, не заблокированные. Можно
        отправить всем подходящим пользователям или выбрать конкретных людей и
        указать каналы доставки на каждого. Для email нужен SMTP на сервере;
        для Telegram нужен привязанный Telegram ID. Реальную доставку проверяем
        по ответу Telegram после отправки.
      </p>

      <div className={styles.card}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px',
          }}
        >
          <span style={{ fontWeight: 'bold' }}>Оценка получателей:</span>
          <button
            type="button"
            onClick={() => {
              loadPreview();
              loadEligible();
            }}
            disabled={previewLoading || eligibleLoading}
            className={styles.buttonGrey}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FaSync size={14} />
            Обновить
          </button>
          <span style={{ color: '#444', fontSize: '15px' }}>
            <FaPaperPlane style={{ marginRight: '6px', opacity: 0.7 }} />
            Email: {recipientCountEmail != null ? recipientCountEmail : '—'} ·
            Telegram:{' '}
            {recipientCountTelegram != null ? recipientCountTelegram : '—'}
          </span>
        </div>
        <div
          style={{
            background: '#fafafa',
            border: '1px solid #eee',
            borderRadius: 6,
            padding: '10px 12px',
            margin: '-4px 0 16px',
            color: '#444',
            fontSize: 13,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>
            Почему число меньше общего списка пользователей
          </div>
          <div>
            В текущем фильтре найдено пользователей: <b>{eligibleStats.total}</b>.
            Email доступен: <b>{eligibleStats.emailAvailable}</b>. Telegram ID есть
            у: <b>{eligibleStats.telegramAvailable}</b>.
          </div>
          <div style={{ color: hiddenTelegramCount ? '#8a6d00' : '#666' }}>
            Не попали в Telegram-оценку:{' '}
            <b>{hiddenTelegramCount}</b>
            {' '}· без Telegram ID:{' '}
            <b>{eligibleStats.telegramNoId}</b>.
          </div>
          {eligibleStats.telegramNoStartMark > 0 && (
            <div style={{ color: '#8a6d00' }}>
              Нет отметки /start в базе:{' '}
              <b>{eligibleStats.telegramNoStartMark}</b>. Отправка всё равно будет
              выполнена, а результат попадёт в отчёт доставки.
            </div>
          )}
          {onlyBrowserUsers && (
            <div style={{ color: '#666' }}>
              Включён дополнительный фильтр: только пользователи с доступом через
              браузер.
            </div>
          )}
          {noStartUsers.length > 0 && (
            <details style={{ marginTop: 8 }}>
              <summary
                style={{
                  cursor: 'pointer',
                  color: '#8a6d00',
                  fontWeight: 600,
                }}
              >
                Показать список без отметки /start в базе ({noStartUsers.length})
              </summary>
              <div
                style={{
                  maxHeight: 260,
                  overflow: 'auto',
                  marginTop: 8,
                  border: '1px solid #eee',
                  borderRadius: 4,
                  background: '#fff',
                }}
              >
                <table style={tableStyles}>
                  <thead style={{ background: '#f4f4f4' }}>
                    <tr>
                      <th style={cellStyles}>Имя</th>
                      <th style={cellStyles}>Отдел / должность</th>
                      <th style={cellStyles}>Контакты</th>
                      <th style={cellStyles}>Telegram ID</th>
                    </tr>
                  </thead>
                  <tbody>
                    {noStartUsers.map((u) => {
                      const fullName =
                        `${u.last_name || ''} ${u.first_name || ''}`.trim() ||
                        `id:${u.id}`;
                      return (
                        <tr key={`no-start-${u.id}`}>
                          <td style={cellStyles}>{fullName}</td>
                          <td style={cellStyles}>
                            {u.department || '—'}
                            {u.position ? ` · ${u.position}` : ''}
                          </td>
                          <td style={cellStyles}>{u.email || '—'}</td>
                          <td style={cellStyles}>{u.telegram_id || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </div>

        <form onSubmit={handleSubmit}>
          <label style={sectionHeader}>
            <span style={{ fontWeight: 'bold' }}>Кому отправить?</span>
          </label>
          <div
            style={{
              display: 'flex',
              gap: '16px',
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <label className={styles.checkboxLabel}>
              <input
                type="radio"
                checked={allUsersMode}
                onChange={() => setAllUsersMode(true)}
              />
              Всем подходящим пользователям
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="radio"
                checked={!allUsersMode}
                onChange={() => setAllUsersMode(false)}
              />
              Выбрать конкретных людей и каналы
            </label>
          </div>

          {!allUsersMode && (
            <div
              style={{
                border: '1px solid #e5e5e5',
                borderRadius: 6,
                padding: 12,
                marginBottom: 16,
                background: '#fafafa',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                  marginBottom: 8,
                }}
              >
                <FaSearch />
                <input
                  type="text"
                  className={styles.input}
                  placeholder="Поиск: имя, email, отдел, должность"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: '1 1 240px', maxWidth: 420 }}
                />
                <button
                  type="button"
                  className={styles.buttonGrey}
                  onClick={() => selectAllVisible('auto')}
                >
                  Выбрать всех (видимых)
                </button>
                <button
                  type="button"
                  className={styles.buttonGrey}
                  onClick={() => selectAllVisible('email')}
                >
                  Только email
                </button>
                <button
                  type="button"
                  className={styles.buttonGrey}
                  onClick={() => selectAllVisible('telegram')}
                >
                  Только Telegram
                </button>
                <button
                  type="button"
                  className={styles.buttonGrey}
                  onClick={clearSelection}
                >
                  Снять выбор
                </button>
              </div>
              <div
                style={{
                  marginBottom: 8,
                  fontSize: 13,
                  color: '#555',
                }}
              >
                Выбрано: <b>{selectedSummary.ids.length}</b> · email:{' '}
                <b>{selectedSummary.email}</b> · Telegram:{' '}
                <b>{selectedSummary.telegram}</b>
              </div>
              <div
                style={{
                  maxHeight: 360,
                  overflow: 'auto',
                  border: '1px solid #eee',
                  borderRadius: 4,
                  background: '#fff',
                }}
              >
                {eligibleLoading ? (
                  <div style={{ padding: 16 }}>Загрузка списка…</div>
                ) : (
                  <table style={tableStyles}>
                    <thead style={{ background: '#f4f4f4' }}>
                      <tr>
                        <th style={cellStyles}></th>
                        <th style={cellStyles}>Имя</th>
                        <th style={cellStyles}>Email</th>
                        <th style={cellStyles}>Telegram</th>
                        <th style={cellStyles}>Каналы</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <RecipientRow
                          key={u.id}
                          user={u}
                          selected={!!selection[u.id]}
                          onToggle={setUserSelected}
                          channels={
                            selection[u.id] || { email: false, telegram: false }
                          }
                          onChannelToggle={setUserChannel}
                        />
                      ))}
                      {filteredUsers.length === 0 && (
                        <tr>
                          <td colSpan={5} style={{ padding: 16, color: '#777' }}>
                            Ничего не найдено
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              marginTop: '16px',
            }}
          >
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

          <label
            style={{
              display: 'block',
              marginBottom: '8px',
              fontWeight: 'bold',
              marginTop: '12px',
            }}
          >
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
            Только пользователи с доступом через браузер (рекомендуется для
            ссылки на вход)
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={appendLoginUrl}
              onChange={(e) => setAppendLoginUrl(e.target.checked)}
            />
            Добавить ссылку для входа (WEB_APP_LOGIN_URL) — в письме и в
            Telegram
          </label>

          <button
            type="submit"
            disabled={sending}
            className={styles.buttonGreen}
            style={{ marginTop: '16px' }}
          >
            {sending ? 'Отправка…' : 'Отправить рассылку'}
          </button>
        </form>
      </div>

      {report && <BroadcastReport report={report} />}
    </div>
  );
}

function ReasonBadge({ code, reason }) {
  const text = reason || ERROR_HINTS[code] || code || 'Не удалось доставить';
  let bg = '#fdecea';
  let color = '#b71c1c';
  if (code === 'no_bot_dialog' || code === 'no_dialog') {
    bg = '#fff8e1';
    color = '#8a6d00';
  } else if (code === 'rate_limit' || code === 'timeout' || code === 'network') {
    bg = '#e3f2fd';
    color = '#0d47a1';
  } else if (code === 'topic') {
    bg = '#ede7f6';
    color = '#4527a0';
  }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: 12,
        fontSize: 12,
        background: bg,
        color,
        whiteSpace: 'nowrap',
      }}
      title={code || ''}
    >
      {text}
    </span>
  );
}

function BroadcastReport({ report }) {
  const [exporting, setExporting] = useState(false);

  const sentEmail = report.recipients.filter(
    (r) => r.channel === 'email' && r.ok,
  );
  const failedEmail = report.recipients.filter(
    (r) => r.channel === 'email' && !r.ok,
  );
  const sentTelegram = report.recipients.filter(
    (r) => r.channel === 'telegram' && r.ok,
  );
  const failedTelegram = report.recipients.filter(
    (r) => r.channel === 'telegram' && !r.ok,
  );

  // Сводка по причинам недоставки
  const reasonsSummary = useMemo(() => {
    const map = new Map();
    for (const r of report.recipients) {
      if (r.ok) continue;
      const code = r.error_code || 'other';
      const label = r.reason || ERROR_HINTS[code] || code;
      const cur = map.get(code) || { code, label, count: 0, channel: r.channel };
      cur.count += 1;
      map.set(code, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [report]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await exportBroadcastReport({
        subject: report.subject || '',
        sent_at: report.sent_at || null,
        recipients: report.recipients,
        sent_ok_email: report.sent_ok_email || 0,
        sent_ok_telegram: report.sent_ok_telegram || 0,
        recipient_count_email: report.recipient_count_email || 0,
        recipient_count_telegram: report.recipient_count_telegram || 0,
      });
      const blob = new Blob([response.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date()
        .toISOString()
        .replace(/[-:]/g, '')
        .slice(0, 13);
      a.href = url;
      a.download = `broadcast_report_${stamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Не удалось скачать Excel-отчёт', e);
    } finally {
      setExporting(false);
    }
  };

  const renderGroup = (title, items, ok) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginTop: 16 }}>
        <h4
          style={{
            margin: '0 0 6px 0',
            color: ok ? '#2e7d32' : '#b71c1c',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {ok ? <FaCheckCircle /> : <FaTimesCircle />} {title} ({items.length})
        </h4>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          {items.map((r, idx) => (
            <li
              key={`${r.channel}-${r.user_id}-${idx}`}
              style={{ marginBottom: 6, lineHeight: 1.5 }}
            >
              <b>{r.name || `id:${r.user_id}`}</b>
              {r.department ? (
                <span style={{ color: '#888', fontSize: 12, marginLeft: 6 }}>
                  {r.department}
                  {r.position ? ` · ${r.position}` : ''}
                </span>
              ) : null}
              <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                {r.channel === 'email' ? '📧 ' : '💬 '}
                {r.target || '—'}
                {r.phone ? ` · ☎ ${r.phone}` : ''}
              </div>
              {!ok ? (
                <div style={{ marginTop: 4 }}>
                  <ReasonBadge code={r.error_code} reason={r.reason} />
                  {r.detail ? (
                    <div
                      style={{
                        fontSize: 11,
                        color: '#888',
                        marginTop: 2,
                        wordBreak: 'break-word',
                      }}
                    >
                      {r.detail}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    );
  };

  return (
    <div className={styles.card} style={{ marginTop: 20 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h3 style={{ margin: 0 }}>Отчёт о доставке</h3>
        <button
          type="button"
          className={styles.buttonGreen}
          disabled={exporting || !report.recipients.length}
          onClick={handleExport}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <FaFileExcel />
          {exporting ? 'Готовим Excel…' : 'Скачать Excel'}
        </button>
      </div>
      <div style={{ color: '#555', margin: '8px 0' }}>{report.message}</div>

      {reasonsSummary.length > 0 && (
        <div
          style={{
            background: '#fafafa',
            border: '1px solid #eee',
            borderRadius: 6,
            padding: 12,
            marginTop: 8,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>
            Причины недоставки
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {reasonsSummary.map((row) => (
              <div
                key={row.code}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 13,
                }}
              >
                <ReasonBadge code={row.code} reason={row.label} />
                <span style={{ color: '#444', fontWeight: 600 }}>
                  {row.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {renderGroup('Email — доставлено', sentEmail, true)}
      {renderGroup('Email — не доставлено', failedEmail, false)}
      {renderGroup('Telegram — доставлено', sentTelegram, true)}
      {renderGroup('Telegram — не доставлено', failedTelegram, false)}
      {report.recipients.length === 0 && (
        <div style={{ color: '#777' }}>Нет получателей в отчёте.</div>
      )}
    </div>
  );
}

export default EmailBroadcast;
