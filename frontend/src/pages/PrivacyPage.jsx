import React from 'react';
import styles from './StatusPages.module.css'; // Будем использовать общие стили для заглушек

function PrivacyPage() {
  return (
    <div className={styles.statusContainer}>
      <div className={styles.statusCard}>
        <h2>Не удалось получить ваш ID</h2>
        <p>
          Вероятно, в ваших настройках конфиденциальности Telegram скрыта пересылка сообщений. 
          Наше приложение использует эту функцию для вашей идентификации и отправки уведомлений.
        </p>
        <div className={styles.instructions}>
          <strong>Как это исправить:</strong>
          <ol>
            <li>Откройте <strong>Настройки</strong> в Telegram.</li>
            <li>Перейдите в раздел <strong>Конфиденциальность</strong>.</li>
            <li>Найдите пункт <strong>Пересылка сообщений</strong>.</li>
            <li>Измените значение на <strong>"Все"</strong> или "Мои контакты".</li>
            <li>Полностью перезапустите приложение.</li>
          </ol>
        </div>
        <p>
          После изменения настроек вы сможете успешно зарегистрироваться.
        </p>
      </div>
    </div>
  );
}

export default PrivacyPage;
