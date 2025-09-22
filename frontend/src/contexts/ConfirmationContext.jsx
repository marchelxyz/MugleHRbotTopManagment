// frontend/src/contexts/ConfirmationContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

const ConfirmationContext = createContext();

export function ConfirmationProvider({ children }) {
  const [confirmState, setConfirmState] = useState(null);

  const confirm = useCallback((title, message) => {
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

  return (
    <ConfirmationContext.Provider value={{ confirm }}>
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
  return useContext(ConfirmationContext);
};
