// hooks/useTelegramId.js

import { useMemo } from 'react';

export const useTelegramId = () => {
  return useMemo(() => {
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.id;
  }, []);
};
