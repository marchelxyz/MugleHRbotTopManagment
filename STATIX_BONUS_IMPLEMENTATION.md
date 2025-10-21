# Внедрение товара "Бонусы Statix"

## Обзор изменений

Добавлен новый товар "Бонусы Statix" в магазин с возможностью покупки бонусов через ползунок и настройкой курса валют в админ-панели.

## Что было реализовано

### 1. Backend изменения

#### Модель данных (`backend/models.py`)
- Добавлена таблица `StatixBonusItem` с полями:
  - `name` - название товара
  - `description` - описание
  - `image_url` - ссылка на изображение (формат 4:3)
  - `is_active` - активность товара
  - `thanks_to_statix_rate` - курс валют (спасибки за 100 бонусов)
  - `min_bonus_per_step` - минимум бонусов за шаг
  - `max_bonus_per_step` - максимум бонусов за шаг
  - `bonus_step` - шаг увеличения

#### API эндпоинты
- `GET /market/statix-bonus` - получить настройки товара
- `POST /market/statix-bonus/purchase` - купить бонусы
- `GET /admin/statix-bonus` - получить настройки (админ)
- `PUT /admin/statix-bonus` - обновить настройки (админ)

#### CRUD операции (`backend/crud.py`)
- `get_statix_bonus_item()` - получить активный товар
- `create_statix_bonus_item()` - создать товар
- `update_statix_bonus_item()` - обновить товар
- `create_statix_bonus_purchase()` - создать покупку

### 2. Frontend изменения

#### Новый компонент (`frontend/src/components/StatixBonusCard.jsx`)
- Ползунок для выбора количества бонусов (100-10000 с шагом 100)
- Отображение стоимости в спасибках
- Красивый дизайн с градиентами
- Адаптивная верстка

#### Интеграция в магазин (`frontend/src/pages/MarketplacePage.jsx`)
- StatixBonusCard отображается первым в магазине
- Интеграция с системой покупок

#### Админ-панель (`frontend/src/pages/admin/ItemManager.jsx`)
- Новый раздел "Настройки Statix Bonus"
- Управление курсом валют
- Настройка изображения товара
- Настройка диапазона бонусов

#### Обновленное модальное окно (`frontend/src/components/PurchaseSuccessModal.jsx`)
- Отображение количества купленных бонусов
- Специальные стили для бонусов

### 3. База данных

#### Миграция (`backend/migrations/001_create_statix_bonus_table.sql`)
- Создание таблицы `statix_bonus_items`
- Запись по умолчанию с курсом 10 спасибок = 100 бонусов
- Индексы для оптимизации

## Курс валют

По умолчанию установлен курс:
- **10 спасибок = 100 бонусов Statix**
- **20 спасибок = 200 бонусов Statix**
- **100 спасибок = 1000 бонусов Statix**
- **1000 спасибок = 10000 бонусов Statix**

Курс можно изменить в админ-панели.

## Установка

### 1. Выполните миграцию базы данных

```sql
-- Выполните SQL из файла:
-- backend/migrations/001_create_statix_bonus_table.sql
```

### 2. Перезапустите backend сервер

```bash
cd backend
python3 -m uvicorn app:app --reload
```

### 3. Перезапустите frontend

```bash
cd frontend
npm run dev
```

## Настройка

### В админ-панели:
1. Перейдите в раздел "Управление товарами"
2. Найдите раздел "Настройки Statix Bonus"
3. Настройте:
   - Название и описание товара
   - Изображение (формат 4:3)
   - Курс валют (спасибки за 100 бонусов)
   - Диапазон бонусов (мин/макс/шаг)

## API для интеграции с Statix Bonus

В функции `create_statix_bonus_purchase()` в `backend/crud.py` есть TODO комментарий для интеграции с API Statix Bonus:

```python
# TODO: Здесь будет интеграция с API Statix Bonus для начисления бонусов
# Пока что просто сохраняем информацию о покупке
```

Когда API Statix Bonus будет готово, нужно будет:
1. Добавить HTTP клиент для вызова API Statix Bonus
2. Передавать данные о покупке в их систему
3. Обрабатывать ответы и ошибки

## Особенности

- Товар отображается только если `is_active = true`
- Ползунок работает в диапазоне от `min_bonus_per_step` до `max_bonus_per_step`
- Шаг ползунка равен `bonus_step`
- Стоимость рассчитывается автоматически по формуле: `(bonus_amount / 100) * thanks_to_statix_rate`
- Покупка блокируется при недостатке спасибок
- После покупки ползунок сбрасывается к минимальному значению

## Файлы изменений

### Backend:
- `backend/models.py` - новая модель
- `backend/schemas.py` - новые схемы
- `backend/crud.py` - CRUD операции
- `backend/routers/market.py` - API эндпоинты
- `backend/routers/admin.py` - админ API
- `backend/migrations/001_create_statix_bonus_table.sql` - миграция

### Frontend:
- `frontend/src/components/StatixBonusCard.jsx` - новый компонент
- `frontend/src/components/StatixBonusCard.module.css` - стили
- `frontend/src/pages/MarketplacePage.jsx` - интеграция
- `frontend/src/pages/admin/ItemManager.jsx` - админ панель
- `frontend/src/components/PurchaseSuccessModal.jsx` - модальное окно
- `frontend/src/components/PurchaseSuccessModal.module.css` - стили модального окна
- `frontend/src/pages/AdminPage.module.css` - стили админ панели
- `frontend/src/api.js` - API функции