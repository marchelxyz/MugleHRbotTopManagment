// hooks/useSession.js

import { useEffect, useCallback, useRef } from 'react';
import { startSession, pingSession } from '../api';

export const useSession = (telegramId) => {
  const pingIntervalRef = useRef(null);

  const startUserSession = useCallback(async () => {
    if (!telegramId) return;
    
    try {
      await startSession(telegramId);
    } catch (err) {
      console.error('Error starting session:', err);
    }
  }, [telegramId]);

  const pingUserSession = useCallback(async () => {
    if (!telegramId) return;
    
    try {
      await pingSession(telegramId);
    } catch (err) {
      console.error('Error pinging session:', err);
    }
  }, [telegramId]);

  const startPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
    }
    
    pingIntervalRef.current = setInterval(() => {
      pingUserSession();
    }, 30000); // Пинг каждые 30 секунд
  }, [pingUserSession]);

  const stopPingInterval = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (telegramId) {
      startUserSession();
      startPingInterval();
    }

    return () => {
      stopPingInterval();
    };
  }, [telegramId, startUserSession, startPingInterval, stopPingInterval]);

  return {
    startUserSession,
    pingUserSession,
    startPingInterval,
    stopPingInterval
  };
};
