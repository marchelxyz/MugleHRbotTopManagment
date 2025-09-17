// frontend/src/contexts/ModalAlertContext.jsx
import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomAlert from '../components/CustomAlert';

const ModalAlertContext = createContext();

export function ModalAlertProvider({ children }) {
  const [alertState, setAlertState] = useState({ message: null, type: 'success', title: '' });

  const showAlert = useCallback((message, type = 'success') => {
    const title = type === 'success' ? 'Успех!' : 'Ошибка';
    setAlertState({ message, type, title });
  }, []);

  const hideAlert = useCallback(() => {
    setAlertState({ message: null, type: 'success', title: '' });
  }, []);

  return (
    <ModalAlertContext.Provider value={{ showAlert }}>
      {children}
      <CustomAlert 
        message={alertState.message}
        type={alertState.type}
        title={alertState.title}
        onClose={hideAlert}
      />
    </ModalAlertContext.Provider>
  );
}

export const useModalAlert = () => {
  return useContext(ModalAlertContext);
};
