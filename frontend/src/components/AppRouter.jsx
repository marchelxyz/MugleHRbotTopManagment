// components/AppRouter.jsx

import React from 'react';
import { useTelegramId } from '../hooks/useTelegramId';
import { useUser } from '../hooks/useUser';
import { useSession } from '../hooks/useSession';
import LoadingScreen from './LoadingScreen';
import OnboardingStories from './OnboardingStories';
import PageLayout from './PageLayout';
import HomePage from '../pages/HomePage';
import ProfilePage from '../pages/ProfilePage';
import MarketplacePage from '../pages/MarketplacePage';
import RoulettePage from '../pages/RoulettePage';
import LeaderboardPage from '../pages/LeaderboardPage';
import HistoryPage from '../pages/HistoryPage';
import SettingsPage from '../pages/SettingsPage';
import TransferPage from '../pages/TransferPage';
import BonusCardPage from '../pages/BonusCardPage';
import EditProfilePage from '../pages/EditProfilePage';
import FaqPage from '../pages/FaqPage';
import PrivacyPage from '../pages/PrivacyPage';
import AdminPage from '../pages/AdminPage';
import BlockedPage from '../pages/BlockedPage';
import PendingPage from '../pages/PendingPage';
import RejectedPage from '../pages/RejectedPage';
import UnsupportedDevicePage from '../pages/UnsupportedDevicePage';

const AppRouter = () => {
  const telegramId = useTelegramId();
  const { user, loading, checkUser, completeOnboarding, updateUser } = useUser();
  useSession(telegramId);

  // Проверяем статус пользователя при загрузке
  React.useEffect(() => {
    if (telegramId) {
      checkUser(telegramId);
    }
  }, [telegramId, checkUser]);

  // Обработка завершения онбординга
  const handleOnboardingComplete = React.useCallback(async () => {
    if (telegramId) {
      await completeOnboarding(telegramId);
    }
  }, [telegramId, completeOnboarding]);

  // Обработка успешного перевода
  const handleTransferSuccess = React.useCallback((updatedUser) => {
    updateUser(updatedUser);
    // Очищаем кэш ленты
    if (window.Telegram?.WebApp?.CloudStorage) {
      window.Telegram.WebApp.CloudStorage.removeItem('feed');
    }
  }, [updateUser]);

  // Проверка поддержки устройства
  if (!window.Telegram?.WebApp) {
    return <UnsupportedDevicePage />;
  }

  // Показываем загрузку
  if (loading) {
    return <LoadingScreen />;
  }

  // Показываем онбординг
  if (user && !user.has_seen_onboarding) {
    return <OnboardingStories onComplete={handleOnboardingComplete} />;
  }

  // Определяем страницу на основе статуса пользователя
  const getPage = () => {
    if (!user) return null;

    switch (user.status) {
      case 'pending':
        return <PendingPage />;
      case 'blocked':
        return <BlockedPage />;
      case 'rejected':
        return <RejectedPage />;
      case 'approved':
        return <HomePage />;
      default:
        return <HomePage />;
    }
  };

  const isOnboardingVisible = user && !user.has_seen_onboarding;
  const isUserApproved = user && user.status === 'approved';
  const showSideNav = isUserApproved && !isOnboardingVisible;
  const showBottomNav = isUserApproved && !isOnboardingVisible;

  return (
    <PageLayout
      showSideNav={showSideNav}
      showBottomNav={showBottomNav}
      user={user}
      onTransferSuccess={handleTransferSuccess}
    >
      {getPage()}
    </PageLayout>
  );
};

export default AppRouter;
