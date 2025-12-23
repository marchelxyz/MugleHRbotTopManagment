# Рекомендации по оптимизации производительности приложения

## 📋 Содержание
1. [Оптимизация загрузки приложения](#1-оптимизация-загрузки-приложения)
2. [Оптимизация переходов между страницами](#2-оптимизация-переходов-между-страницами)
3. [Оптимизация отклика UI](#3-оптимизация-отклика-ui)
4. [Систематизация загрузки приложения](#4-систематизация-загрузки-приложения)
5. [Оптимизация бэкенда](#5-оптимизация-бэкенда)

---

## 1. Оптимизация загрузки приложения

### 1.1. Code Splitting и Lazy Loading страниц

**Проблема:** Все страницы импортируются синхронно в `App.jsx`, что увеличивает initial bundle size.

**Решение:**
```javascript
// Вместо:
import HomePage from './pages/HomePage';
import LeaderboardPage from './pages/LeaderboardPage';
// ... и т.д.

// Использовать:
import { lazy, Suspense } from 'react';

const HomePage = lazy(() => import('./pages/HomePage'));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage'));
const MarketplacePage = lazy(() => import('./pages/MarketplacePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
// ... остальные страницы

// В renderPage обернуть в Suspense:
<Suspense fallback={<LoadingScreen />}>
  {renderPage()}
</Suspense>
```

**Ожидаемый эффект:** Сокращение initial bundle на 60-70%, загрузка страниц по требованию.

---

### 1.2. Разделение vendor chunks

**Текущее состояние:** Уже есть разделение на `react-vendor` и `axios-vendor`, но можно улучшить.

**Рекомендации:**
```javascript
// vite.config.js
build: {
  rollupOptions: {
    output: {
      manualChunks: {
        'react-vendor': ['react', 'react-dom'],
        'axios-vendor': ['axios'],
        'chart-vendor': ['chart.js', 'react-chartjs-2'],
        'date-vendor': ['react-datepicker', 'date-fns'],
        'icons-vendor': ['react-icons'],
        'animations-vendor': ['react-lottie-player', 'lottie-web'],
      },
    },
  },
  chunkSizeWarningLimit: 500, // Уменьшить лимит для лучшего контроля
}
```

**Ожидаемый эффект:** Лучшее кеширование библиотек, независимое обновление чанков.

---

### 1.3. Preload критических ресурсов

**Текущее состояние:** Есть preload для некоторых изображений, но можно расширить.

**Рекомендации:**
```html
<!-- В index.html добавить: -->
<link rel="preload" as="script" href="/assets/react-vendor-Cwh1aMWO.js">
<link rel="preload" as="script" href="/assets/axios-vendor-B9ygI19o.js">
<link rel="prefetch" as="script" href="/assets/chart-vendor-*.js"> <!-- для страниц со статистикой -->
```

**Ожидаемый эффект:** Ускорение загрузки критических ресурсов на 20-30%.

---

### 1.4. Оптимизация шрифтов

**Проблема:** Загрузка шрифта Inter происходит синхронно.

**Решение:**
```html
<!-- В index.html: -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500&display=swap" rel="stylesheet" media="print" onload="this.media='all'">
<noscript>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@500&display=swap" rel="stylesheet">
</noscript>
```

**Альтернатива:** Использовать `font-display: swap` в CSS или подключить шрифт локально.

**Ожидаемый эффект:** Устранение блокировки рендеринга из-за шрифтов.

---

### 1.5. Оптимизация изображений

**Текущее состояние:** Используется `loading="lazy"`, но можно улучшить.

**Рекомендации:**
1. **Использовать WebP формат** с fallback:
```jsx
<picture>
  <source srcSet={imageUrl.replace('.webp', '.webp')} type="image/webp" />
  <img src={imageUrl} alt={alt} loading="lazy" />
</picture>
```

2. **Добавить blur placeholder** для изображений:
```jsx
<img 
  src={imageUrl} 
  alt={alt}
  loading="lazy"
  decoding="async"
  style={{ background: 'linear-gradient(90deg, #f0f0f0 25%, transparent 37%)' }}
/>
```

3. **Использовать srcset для responsive изображений**:
```jsx
<img 
  srcSet={`${imageUrl}?w=400 400w, ${imageUrl}?w=800 800w`}
  sizes="(max-width: 768px) 400px, 800px"
  src={imageUrl}
  loading="lazy"
/>
```

**Ожидаемый эффект:** Сокращение времени загрузки изображений на 40-60%.

---

## 2. Оптимизация переходов между страницами

### 2.1. Предзагрузка данных для следующей страницы

**Проблема:** При переходе на страницу данные загружаются только после монтирования компонента.

**Решение:** Предзагружать данные при наведении/фокусе на навигационные элементы:

```javascript
// В BottomNav.jsx и SideNav.jsx:
const handleNavHover = (page) => {
  // Предзагружаем данные для страницы
  switch(page) {
    case 'marketplace':
      import('./api').then(({ getMarketItems }) => {
        getMarketItems().then(res => {
          setCachedData('market', res.data);
        });
      });
      break;
    case 'leaderboard':
      import('./api').then(({ getLeaderboard }) => {
        getLeaderboard({ period: 'current_month', type: 'received' })
          .then(res => setCachedData('leaderboard', res.data));
      });
      break;
  }
};

// Добавить onMouseEnter или onTouchStart:
<button onMouseEnter={() => handleNavHover('marketplace')}>
```

**Ожидаемый эффект:** Мгновенный переход на страницу с уже загруженными данными.

---

### 2.2. Оптимизация кеширования

**Текущее состояние:** Кеш работает через Redis и localStorage, но можно улучшить стратегию.

**Рекомендации:**

1. **Добавить TTL для кеша:**
```javascript
// В storage.js:
export const setCachedData = async (key, data, ttl = 300) => { // 5 минут по умолчанию
  memoryCache[key] = data;
  const timestamp = Date.now();
  const cacheData = { data, timestamp, ttl };
  
  // Сохраняем с метаданными
  await setCacheAPI(key, cacheData, ttl);
};

export const getCachedData = (key) => {
  const cached = memoryCache[key];
  if (!cached) return null;
  
  // Проверяем TTL
  if (cached.timestamp && Date.now() - cached.timestamp > cached.ttl * 1000) {
    memoryCache[key] = null;
    return null;
  }
  
  return cached.data || cached;
};
```

2. **Использовать stale-while-revalidate паттерн:**
```javascript
const getCachedDataWithRefresh = async (key, fetchFn) => {
  const cached = getCachedData(key);
  
  // Возвращаем кеш сразу, если есть
  if (cached) {
    // Обновляем в фоне
    fetchFn().then(data => setCachedData(key, data)).catch(() => {});
    return cached;
  }
  
  // Если нет кеша, загружаем
  const data = await fetchFn();
  setCachedData(key, data);
  return data;
};
```

**Ожидаемый эффект:** Мгновенная загрузка из кеша + фоновое обновление.

---

### 2.3. Оптимизация рендеринга списков

**Проблема:** Большие списки (feed, leaderboard) рендерятся полностью.

**Решение:** Использовать виртуализацию для длинных списков:

```bash
npm install react-window
```

```javascript
import { FixedSizeList } from 'react-window';

// В HomePage.jsx для feed:
<FixedSizeList
  height={600}
  itemCount={feed.length}
  itemSize={80}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <FeedItem item={feed[index]} />
    </div>
  )}
</FixedSizeList>
```

**Ожидаемый эффект:** Рендеринг только видимых элементов, снижение нагрузки на 80-90%.

---

### 2.4. Мемоизация тяжелых вычислений

**Проблема:** `groupedFeed` пересчитывается при каждом рендере.

**Решение:** Использовать `useMemo` с правильными зависимостями:

```javascript
// В HomePage.jsx уже есть useMemo, но можно оптимизировать:
const groupedFeed = useMemo(() => {
  if (!feed || feed.length === 0) return {};
  
  const grouped = {};
  feed.forEach(item => {
    const dateKey = formatToMsk(item.timestamp, { 
      year: undefined, 
      month: undefined, 
      day: undefined 
    });
    if (!grouped[dateKey]) {
      grouped[dateKey] = [];
    }
    grouped[dateKey].push(item);
  });
  
  return grouped;
}, [feed]); // Зависимость только от feed
```

**Ожидаемый эффект:** Избежание лишних пересчетов при ререндерах.

---

## 3. Оптимизация отклика UI

### 3.1. Debounce для resize событий

**Текущее состояние:** Есть debounce на 100ms, но можно оптимизировать.

**Рекомендации:**
```javascript
// Использовать requestAnimationFrame для более плавного debounce:
useEffect(() => {
  let rafId = null;
  
  const handleResize = () => {
    if (rafId) cancelAnimationFrame(rafId);
    
    rafId = requestAnimationFrame(() => {
      setWindowWidth(window.innerWidth);
      rafId = null;
    });
  };
  
  window.addEventListener('resize', handleResize, { passive: true });
  return () => {
    window.removeEventListener('resize', handleResize);
    if (rafId) cancelAnimationFrame(rafId);
  };
}, []);
```

**Ожидаемый эффект:** Более плавная обработка resize событий.

---

### 3.2. Оптимизация useEffect зависимостей

**Проблема:** Некоторые useEffect имеют избыточные зависимости или выполняются слишком часто.

**Примеры оптимизации:**

1. **В HomePage.jsx:**
```javascript
// Текущий код:
useEffect(() => {
  const fetchData = async () => {
    // ...
  };
  fetchData();
}, [feed, banners]); // Проблема: зависимости могут вызывать лишние запросы

// Оптимизированный:
useEffect(() => {
  const fetchData = async () => {
    if (!banners || banners.length === 0) {
      const bannersResponse = await getBanners();
      setBanners(bannersResponse.data);
    }
    if (!feed) {
      const feedResponse = await getFeed();
      setFeed(feedResponse.data);
    }
    setIsLoading(false);
  };
  fetchData();
}, []); // Запускаем только один раз при монтировании
```

2. **В LeaderboardPage.jsx:**
```javascript
// Оптимизировать fetchData:
const fetchData = useCallback(async () => {
  setIsLoading(true);
  try {
    const tabConfig = ALL_TABS.find(t => t.id === activeTabId);
    if (!tabConfig) { setIsLoading(false); return; }
    
    const [leaderboardRes, myRankRes] = await Promise.all([
      getLeaderboard(tabConfig.params),
      getMyRank(tabConfig.params)
    ]);
    setLeaderboard(leaderboardRes.data);
    setMyRank(myRankRes.data);
  } catch (error) {
    console.error("Failed to fetch leaderboard data", error);
  } finally {
    setIsLoading(false);
  }
}, [activeTabId]); // Только activeTabId как зависимость
```

**Ожидаемый эффект:** Устранение лишних API запросов и ререндеров.

---

### 3.3. React.memo для компонентов

**Рекомендации:** Обернуть компоненты, которые часто ререндерятся:

```javascript
// В компонентах навигации:
export default React.memo(BottomNav);
export default React.memo(SideNav);

// В компонентах карточек:
export default React.memo(BonusCard);
export default React.memo(StatixBonusCard);

// С кастомным сравнением:
export default React.memo(UserAvatar, (prevProps, nextProps) => {
  return prevProps.user.id === nextProps.user.id &&
         prevProps.user.telegram_photo_url === nextProps.user.telegram_photo_url;
});
```

**Ожидаемый эффект:** Снижение количества ререндеров на 30-50%.

---

### 3.4. Оптимизация состояния

**Проблема:** Множественные useState могут вызывать лишние ререндеры.

**Решение:** Объединить связанное состояние:

```javascript
// Вместо:
const [feed, setFeed] = useState(null);
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState(null);

// Использовать:
const [feedState, setFeedState] = useState({
  data: null,
  loading: true,
  error: null
});

// Или использовать useReducer для сложного состояния:
const feedReducer = (state, action) => {
  switch(action.type) {
    case 'LOADING':
      return { ...state, loading: true };
    case 'SUCCESS':
      return { data: action.payload, loading: false, error: null };
    case 'ERROR':
      return { ...state, loading: false, error: action.payload };
    default:
      return state;
  }
};
```

**Ожидаемый эффект:** Меньше ререндеров, более предсказуемое состояние.

---

## 4. Систематизация загрузки приложения

### 4.1. Правильный порядок загрузки

**Текущая последовательность:**
1. Загрузка HTML
2. Загрузка всех скриптов синхронно
3. Инициализация React
4. Проверка пользователя
5. Загрузка данных

**Оптимизированная последовательность:**

```
1. HTML + Critical CSS (inline)
   ↓
2. Preload критических ресурсов (React, Axios)
   ↓
3. Загрузка и выполнение React vendor chunk
   ↓
4. Инициализация React приложения
   ↓
5. Показ LoadingScreen (мгновенно)
   ↓
6. Параллельная загрузка:
   - Проверка пользователя (checkUserStatus)
   - Инициализация кеша (initializeCache)
   - Предзагрузка критических данных (feed, banners)
   ↓
7. Определение статуса пользователя
   ↓
8. Загрузка соответствующей страницы (lazy)
   ↓
9. Отображение контента
```

**Реализация:**

```javascript
// В App.jsx создать систему приоритетов загрузки:
const LOADING_PRIORITIES = {
  CRITICAL: 1,    // Пользователь, статус
  HIGH: 2,        // Feed, banners для HomePage
  MEDIUM: 3,      // Market items, leaderboard
  LOW: 4          // История, настройки
};

const loadWithPriority = async (priority, loader) => {
  // Реализация очереди загрузки
};
```

---

### 4.2. Централизованная система загрузки данных

**Создать хук для управления загрузкой:**

```javascript
// hooks/useDataLoader.js
import { useState, useEffect, useRef } from 'react';

export const useDataLoader = (key, loaderFn, options = {}) => {
  const { 
    cacheKey = key,
    priority = LOADING_PRIORITIES.MEDIUM,
    staleTime = 5 * 60 * 1000, // 5 минут
    cacheFirst = true
  } = options;
  
  const [data, setData] = useState(() => {
    if (cacheFirst) {
      return getCachedData(cacheKey);
    }
    return null;
  });
  
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState(null);
  const lastFetchRef = useRef(0);
  
  useEffect(() => {
    const shouldFetch = !data || 
                       (Date.now() - lastFetchRef.current > staleTime);
    
    if (shouldFetch) {
      setLoading(true);
      loaderFn()
        .then(result => {
          setData(result.data || result);
          setCachedData(cacheKey, result.data || result);
          lastFetchRef.current = Date.now();
        })
        .catch(err => {
          setError(err);
          // Если есть кеш, используем его при ошибке
          if (data) {
            console.warn('Используем кеш из-за ошибки загрузки');
          }
        })
        .finally(() => setLoading(false));
    }
  }, [key]);
  
  return { data, loading, error, refetch: () => {
    lastFetchRef.current = 0;
    // Триггерит повторную загрузку
  }};
};

// Использование:
const { data: feed, loading } = useDataLoader('feed', getFeed, {
  priority: LOADING_PRIORITIES.HIGH,
  cacheFirst: true
});
```

---

### 4.3. Оптимизация инициализации кеша

**Текущая проблема:** `initializeCache` загружает все данные последовательно.

**Оптимизация:**

```javascript
// В storage.js:
export const initializeCache = async () => {
  console.log('Initializing cache...');
  
  // 1. Сначала загружаем из localStorage/Redis (быстро)
  const [feed, market, leaderboard, banners] = await Promise.all([
    getStoredValue('feed'),
    getStoredValue('market'),
    getStoredValue('leaderboard'),
    getStoredValue('banners')
  ]);
  
  // 2. Заполняем memory cache синхронно
  memoryCache.feed = feed;
  memoryCache.market = market;
  memoryCache.leaderboard = leaderboard;
  memoryCache.banners = banners;
  
  console.log('Cache initialized from storage');
  
  // 3. Обновляем данные в фоне (не блокируем UI)
  refreshAllData().catch(err => {
    console.warn('Background refresh failed:', err);
  });
};
```

---

### 4.4. Оптимизация проверки пользователя

**Текущая проблема:** В App.jsx проверка пользователя и загрузка данных смешаны.

**Оптимизация:**

```javascript
// В App.jsx:
useEffect(() => {
  const initializeApp = async () => {
    // 1. Инициализация кеша (быстро, из localStorage)
    await initializeCache();
    
    // 2. Восстановление пользователя из localStorage (мгновенно)
    if (!isTelegramWebApp) {
      const savedUser = localStorage.getItem('user');
      if (savedUser) {
        try {
          setUser(JSON.parse(savedUser));
        } catch (e) {
          console.error('Failed to parse saved user', e);
        }
      }
    }
    
    // 3. Проверка пользователя на сервере (параллельно с предзагрузкой)
    const telegramUser = tg?.initDataUnsafe?.user;
    
    if (telegramUser) {
      // Параллельная загрузка пользователя и критических данных
      const [userResponse, feedResponse, bannersResponse] = await Promise.all([
        checkUserStatus(telegramUser.id),
        getFeed().catch(() => null),
        getBanners().catch(() => null)
      ]);
      
      setUser(userResponse.data);
      
      // Сохраняем предзагруженные данные
      if (feedResponse?.data) {
        await setCachedData('feed', feedResponse.data);
      }
      if (bannersResponse?.data) {
        await setCachedData('banners', bannersResponse.data);
      }
    } else if (!isTelegramWebApp) {
      // Браузерная авторизация
      const savedUserId = localStorage.getItem('userId');
      if (savedUserId) {
        try {
          const userResponse = await checkUserStatusById(savedUserId);
          setUser(userResponse.data);
          localStorage.setItem('user', JSON.stringify(userResponse.data));
        } catch (err) {
          if (err.response?.status === 401 || err.response?.status === 404) {
            localStorage.removeItem('userId');
            localStorage.removeItem('user');
          }
        }
      }
    }
    
    setLoading(false);
  };
  
  initializeApp();
}, []);
```

---

## 5. Оптимизация бэкенда

### 5.1. Оптимизация запросов к БД

**Рекомендации:**

1. **Использовать индексы:**
```sql
-- Для часто используемых запросов:
CREATE INDEX idx_transactions_timestamp ON transactions(timestamp DESC);
CREATE INDEX idx_transactions_sender_receiver ON transactions(sender_id, receiver_id);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_telegram_id ON users(telegram_id);
```

2. **Использовать select_related/prefetch_related (если используется ORM):**
```python
# Вместо:
users = await db.query(User).all()
for user in users:
    transactions = await db.query(Transaction).filter(Transaction.user_id == user.id).all()

# Использовать:
users = await db.query(User).options(
    selectinload(User.transactions)
).all()
```

3. **Пагинация для больших списков:**
```python
@router.get("/transactions/feed")
async def get_feed(
    skip: int = 0,
    limit: int = 50,  # Ограничение по умолчанию
    current_user: User = Depends(get_current_user)
):
    feed = await db.query(Transaction)\
        .order_by(Transaction.timestamp.desc())\
        .offset(skip)\
        .limit(limit)\
        .all()
    return feed
```

---

### 5.2. Оптимизация Redis кеша

**Рекомендации:**

1. **Использовать pipeline для множественных операций:**
```python
async def get_multiple_cache(telegram_id, keys):
    pipe = redis_cache.redis.pipeline()
    for key in keys:
        pipe.get(f"user:{telegram_id}:{key}")
    return pipe.execute()
```

2. **Установить разумные TTL:**
```python
# В redis_cache.py:
DEFAULT_TTL = {
    'feed': 300,           # 5 минут
    'market': 600,         # 10 минут
    'leaderboard': 1800,   # 30 минут
    'banners': 3600,        # 1 час
}
```

3. **Использовать компрессию для больших данных:**
```python
import gzip
import json

async def set_cache_compressed(key, value, ttl=None):
    compressed = gzip.compress(json.dumps(value).encode())
    await redis_cache.set(key, compressed, ttl)
```

---

### 5.3. Оптимизация API endpoints

**Рекомендации:**

1. **Использовать response_model для валидации:**
```python
@router.get("/feed", response_model=List[TransactionSchema])
async def get_feed():
    # FastAPI автоматически сериализует и валидирует
    return feed
```

2. **Добавить compression middleware:**
```python
from fastapi.middleware.gzip import GZipMiddleware

app.add_middleware(GZipMiddleware, minimum_size=1000)
```

3. **Использовать background tasks для не критичных операций:**
```python
from fastapi import BackgroundTasks

@router.post("/points/transfer")
async def transfer_points(
    data: TransferData,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # Основная логика
    result = await process_transfer(data, current_user)
    
    # Обновление кеша в фоне
    background_tasks.add_task(clear_cache, 'feed')
    
    return result
```

---

## 6. Дополнительные оптимизации

### 6.1. Service Worker для offline поддержки

**Реализация:**

```javascript
// public/sw.js
const CACHE_NAME = 'hr-app-v1';
const CRITICAL_ASSETS = [
  '/',
  '/assets/index-zvFJADW9.js',
  '/assets/index-Ca5aQ2AA.css',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(CRITICAL_ASSETS);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
```

---

### 6.2. Оптимизация CSS

**Рекомендации:**

1. **Критический CSS inline:**
```html
<style>
  /* Критический CSS для первого экрана */
  body { margin: 0; }
  .loading-screen { /* ... */ }
</style>
```

2. **Удаление неиспользуемого CSS:**
```bash
npm install purgecss
```

3. **Минификация CSS:**
```javascript
// vite.config.js
build: {
  cssMinify: true,
}
```

---

### 6.3. Мониторинг производительности

**Добавить метрики:**

```javascript
// utils/performance.js
export const measurePerformance = (name, fn) => {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  console.log(`[Performance] ${name}: ${end - start}ms`);
  return result;
};

// Использование:
const feed = await measurePerformance('feed-load', () => getFeed());
```

---

## 7. Приоритеты внедрения

### Высокий приоритет (немедленно):
1. ✅ Lazy loading страниц
2. ✅ Оптимизация useEffect зависимостей
3. ✅ Предзагрузка данных при наведении на навигацию
4. ✅ Оптимизация инициализации кеша

### Средний приоритет (в ближайшее время):
1. ✅ Виртуализация списков
2. ✅ React.memo для компонентов
3. ✅ Оптимизация изображений (WebP)
4. ✅ Улучшение vendor chunks

### Низкий приоритет (по возможности):
1. ✅ Service Worker
2. ✅ Компрессия данных в Redis
3. ✅ Расширенный мониторинг производительности

---

## 8. Ожидаемые результаты

После внедрения всех оптимизаций:

- **Initial Load Time:** сокращение на 50-70% (с ~3-5с до ~1-2с)
- **Time to Interactive:** сокращение на 40-60% (с ~4-6с до ~2-3с)
- **Переходы между страницами:** мгновенные (0-200ms) благодаря предзагрузке
- **Размер initial bundle:** сокращение на 60-70% (с ~500KB до ~150-200KB)
- **FPS при скролле:** стабильные 60 FPS благодаря виртуализации
- **Использование памяти:** снижение на 30-40%

---

## Заключение

Систематический подход к оптимизации позволит значительно улучшить производительность приложения. Рекомендуется внедрять изменения поэтапно, измеряя результаты после каждого этапа.
