// hooks/useUser.js

import { useState, useEffect, useCallback } from 'react';
import { checkUserStatus, registerUser, completeOnboarding as markOnboardingAsSeen } from '../api';

export const useUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkUser = useCallback(async (telegramId) => {
    if (!telegramId) return;
    
    try {
      setLoading(true);
      setError(null);
      const userData = await checkUserStatus(telegramId);
      setUser(userData);
    } catch (err) {
      console.error('Error checking user status:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const registerNewUser = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);
      const newUser = await registerUser(userData);
      setUser(newUser);
      return newUser;
    } catch (err) {
      console.error('Error registering user:', err);
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const completeOnboarding = useCallback(async (telegramId) => {
    try {
      await markOnboardingAsSeen();
      setUser(prev => prev ? { ...prev, has_seen_onboarding: true } : null);
    } catch (err) {
      console.error('Error completing onboarding:', err);
      setError(err.message);
    }
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return {
    user,
    loading,
    error,
    checkUser,
    registerNewUser,
    completeOnboarding,
    updateUser
  };
};
