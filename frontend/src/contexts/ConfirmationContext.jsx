// frontend/src/contexts/ConfirmationContext.jsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

const ConfirmationContext = createContext();

export function ConfirmationProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);

  // --- ИЗМЕНЕНИЕ: Улучшенная логика функции confirm ---
  // Теперь она правильно работает и с одним, и с двумя аргументами.
  const confirm = useCallback((...args) => {
    let title, message;
    
    if (args.length === 1) {
      [title] = args;
      message = ''; // Сообщение будет пустым, если передан только заголовок
    } else if (args.length >= 2) {
      [title, message] = args;
    }

    return new Promise((resolve) => {
      setConfirmState({
        title,
        message,
        onConfirm: () => {
          setConfirmState(null);
          resolve(true);
        },
        onCancel: () => {
          setConfirmState(null);
          resolve(false);
        },
      });
    });
  }, []);

  // Оборачиваем value в useMemo для оптимизации производительности
  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmationContext.Provider value={value}>
      {children}
      {confirmState && (
        <ConfirmDialog
          title={confirmState.title}
          message={confirmState.message}
          onConfirm={confirmState.onConfirm}
          onCancel={confirmState.onCancel}
        />
      )}
    </ConfirmationContext.Provider>
  );
}

export const useConfirmation = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirmation must be used within a ConfirmationProvider');
  }
  return context;
};
