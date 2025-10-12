import React, { useState, useEffect } from 'react';
import { getMarketItems, purchaseItem } from '../api';
import { useModalAlert } from '../contexts/ModalAlertContext';
import { useConfirmation } from '../contexts/ConfirmationContext';
import PageLayout from '../components/PageLayout';
import styles from './MarketplacePage.module.css';
import { FaStar, FaCopy } from 'react-icons/fa';

function MarketplacePage({ user, onPurchaseSuccess }) {
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  // --- ИСПРАВЛЕНИЕ №1: Правильно извлекаем функцию showAlert из объекта ---
  const { showAlert } = useModalAlert();
  const { confirm } = useConfirmation();

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const response = await getMarketItems();
        setItems(response.data);
      } catch (error) {
        console.error("Failed to fetch market items", error);
        // Добавляем проверку, чтобы избежать ошибок при первой загрузке, когда showAlert еще может быть undefined
        if (showAlert) showAlert("Не удалось загрузить товары. Попробуйте позже.");
      } finally {
        setIsLoading(false);
      }
    };
    fetchItems();
  }, [showAlert]); // Добавляем showAlert в зависимости, чтобы избежать предупреждений

  // --- ИСПРАВЛЕНИЕ №2: Полностью переписанная, корректная логика покупки ---
  const handlePurchase = async (itemId, itemName, itemPrice) => {
    console.log("--- Начало процесса покупки ---");
    console.log("Данные товара:", { itemId, itemName, itemPrice });
    console.log("Данные пользователя:", user);

    if (!user || !user.id) {
      console.error("ОШИБКА: ID пользователя не найден. Покупка невозможна.");
      showAlert("Не удалось определить ваш ID. Пожалуйста, перезагрузите страницу.");
      return;
    }

    const isConfirmed = await confirm(`Вы уверены, что хотите купить "${itemName}" за ${itemPrice} спасибок?`);
    
    if (isConfirmed) {
      console.log("Пользователь подтвердил покупку. Отправляем запрос на сервер...");
      try {
        const response = await purchaseItem(user.id, itemId);
        
        console.log("Сервер ответил успешно:", response);

        const { new_balance, issued_code } = response.data;
        
        onPurchaseSuccess({ balance: new_balance });

        if (issued_code) {
          showAlert(
            `Поздравляем с покупкой "${itemName}"!`,
            'success',
            <div className={styles.issuedCodeContainer}>
              <p>Ваш уникальный код/ссылка:</p>
              <div className={styles.codeBox}>
                <code>{issued_code}</code>
                <button onClick={() => navigator.clipboard.writeText(issued_code)} className={styles.copyButton}>
                  <FaCopy />
                </button>
              </div>
              <p className={styles.codeNote}>Код также отправлен вам в личные сообщения ботом.</p>
            </div>
          );
        } else {
          showAlert(`Поздравляем! Вы успешно приобрели "${itemName}".`);
        }
        
        const updatedItems = await getMarketItems();
        setItems(updatedItems.data);

      } catch (error) {
        console.error("--- ОШИБКА ПРИ ПОКУПКЕ ---");
        if (error.response) {
          // Ошибка пришла с сервера (например, 404, 500)
          console.error("Данные ответа сервера:", error.response.data);
          console.error("Статус код:", error.response.status);
          showAlert(error.response.data.detail || `Ошибка сервера: ${error.response.status}`);
        } else if (error.request) {
          // Запрос был сделан, но ответа не было
          console.error("Запрос был отправлен, но ответ не получен:", error.request);
          showAlert("Не удалось связаться с сервером. Проверьте ваше интернет-соединение.");
        } else {
          // Произошла ошибка при настройке запроса
          console.error("Ошибка настройки запроса:", error.message);
          showAlert("Произошла внутренняя ошибка. Не удалось отправить запрос.");
        }
        console.log("Полный объект ошибки:", error);
      }
    } else {
      console.log("Пользователь отменил покупку.");
    }
  };

  const activeItems = items.filter(item => !item.is_archived);

  return (
    <PageLayout title="Кафетерий">
      <p className={styles.balance}>Ваш баланс: <strong>{user?.balance}</strong> спасибок</p>
      {isLoading ? <p>Загрузка товаров...</p> : (
        <div className={styles.itemsGrid}>
          {activeItems.map(item => {
            const currentPrice = Number(item.price);
            const originalPrice = Number(item.original_price);
            const hasDiscount = typeof item.original_price === 'number' && item.original_price > item.price;
            const discountPercent = hasDiscount ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : 0;

            return (
              <div key={item.id} className={styles.itemCard}>
                
                {hasDiscount && (
                  <div className={styles.discountBadge}>
                    <FaStar className={styles.discountIcon} />
                    <span className={styles.discountText}>
                      - {discountPercent}%
                    </span>
                  </div>
                )}

                {item.image_url ? (
                  <img src={item.image_url} alt={item.name} className={styles.itemImage} />
                ) : (
                  <div className={styles.imagePlaceholder}></div>
                )}
                
                <div className={styles.itemContent}>
                  <h2 className={styles.itemName}>{item.name}</h2>
                  <p className={styles.itemDescription}>{item.description}</p>
                  
                  <div className={styles.priceContainer}>
                    <span className={styles.itemPrice}>{currentPrice} спасибок</span>
                    {hasDiscount && (
                      <span className={styles.originalPrice}>
                        {originalPrice}
                      </span>
                    )}
                  </div>

                </div>
                <div className={styles.buttonWrapper}>
                  <button 
                    onClick={() => handlePurchase(item.id, item.name, currentPrice)} 
                    className={styles.purchaseButton}
                    disabled={user?.balance < currentPrice || item.stock <= 0} 
                  >
                    {item.stock > 0 ? 'Купить' : 'Нет в наличии'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}

export default MarketplacePage;
