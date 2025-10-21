// frontend/src/api/index.js

// Заглушки для API функций
export const getFeed = async () => {
  // Заглушка для получения ленты активности
  return {
    data: []
  };
};

export const getBanners = async () => {
  // Заглушка для получения баннеров
  return {
    data: []
  };
};

export const checkUserStatus = async (userId) => {
  // Заглушка для проверки статуса пользователя
  return {
    data: {
      id: userId,
      status: 'approved',
      first_name: 'Test User',
      has_seen_onboarding: true
    }
  };
};

export const startSession = async () => {
  // Заглушка для запуска сессии
  return {
    data: {
      id: 'session-' + Date.now()
    }
  };
};

export const pingSession = async (sessionId) => {
  // Заглушка для пинга сессии
  return {
    data: { success: true }
  };
};

export const registerUser = async (userData) => {
  // Заглушка для регистрации пользователя
  return {
    data: {
      id: userData.id,
      status: 'pending',
      first_name: userData.first_name,
      has_seen_onboarding: false
    }
  };
};

export const completeOnboarding = async (userId) => {
  // Заглушка для завершения обучения
  return {
    data: { success: true }
  };
};

export const addPointsToAll = async (points) => {
  // Заглушка для добавления очков всем пользователям
  return {
    data: { success: true }
  };
};

export const addTicketsToAll = async (tickets) => {
  // Заглушка для добавления билетов всем пользователям
  return {
    data: { success: true }
  };
};

export const getMarketItems = async () => {
  // Заглушка для получения товаров маркета
  return {
    data: []
  };
};

export const purchaseItem = async (itemId, userId) => {
  // Заглушка для покупки товара
  return {
    data: { success: true }
  };
};

export const searchUsers = async (query) => {
  // Заглушка для поиска пользователей
  return {
    data: []
  };
};

export const transferPoints = async (senderId, receiverId, amount, message) => {
  // Заглушка для перевода очков
  return {
    data: { success: true }
  };
};

export const purchaseStatixBonus = async (userId, itemId) => {
  // Заглушка для покупки статик бонуса
  return {
    data: { success: true }
  };
};

export const getStatixBonusItem = async (itemId) => {
  // Заглушка для получения статик бонуса
  return {
    data: { id: itemId, name: 'Test Item', price: 100 }
  };
};

export const spinRoulette = async (userId) => {
  // Заглушка для вращения рулетки
  return {
    data: { prize: 'points', amount: 10 }
  };
};

export const assembleTickets = async (userId) => {
  // Заглушка для сборки билетов
  return {
    data: { success: true }
  };
};

export const getRouletteHistory = async (userId) => {
  // Заглушка для получения истории рулетки
  return {
    data: []
  };
};

export const getUserTransactions = async (userId) => {
  // Заглушка для получения транзакций пользователя
  return {
    data: []
  };
};

export const deleteUserCard = async (userId, cardId) => {
  // Заглушка для удаления карты пользователя
  return {
    data: { success: true }
  };
};

export const requestProfileUpdate = async (userId, profileData) => {
  // Заглушка для запроса обновления профиля
  return {
    data: { success: true }
  };
};

export const exportConsolidatedReport = async () => {
  // Заглушка для экспорта консолидированного отчета
  return {
    data: { success: true }
  };
};

export const adminGetAllUsers = async () => {
  // Заглушка для получения всех пользователей (админ)
  return {
    data: []
  };
};

export const adminUpdateUser = async (userId, userData) => {
  // Заглушка для обновления пользователя (админ)
  return {
    data: { success: true }
  };
};

export const adminDeleteUser = async (userId) => {
  // Заглушка для удаления пользователя (админ)
  return {
    data: { success: true }
  };
};

export const exportAllUsers = async () => {
  // Заглушка для экспорта всех пользователей
  return {
    data: { success: true }
  };
};

export const getLeaderboard = async () => {
  // Заглушка для получения лидерборда
  return {
    data: []
  };
};

export const getMyRank = async (userId) => {
  // Заглушка для получения ранга пользователя
  return {
    data: { rank: 1 }
  };
};

export const getLeaderboardStatus = async () => {
  // Заглушка для получения статуса лидерборда
  return {
    data: { active: true }
  };
};

export const createMarketItem = async (itemData) => {
  // Заглушка для создания товара маркета
  return {
    data: { success: true }
  };
};

export const getAllMarketItems = async () => {
  // Заглушка для получения всех товаров маркета
  return {
    data: []
  };
};

export const updateMarketItem = async (itemId, itemData) => {
  // Заглушка для обновления товара маркета
  return {
    data: { success: true }
  };
};

export const archiveMarketItem = async (itemId) => {
  // Заглушка для архивирования товара маркета
  return {
    data: { success: true }
  };
};

export const getArchivedMarketItems = async () => {
  // Заглушка для получения архивированных товаров маркета
  return {
    data: []
  };
};

export const restoreMarketItem = async (itemId) => {
  // Заглушка для восстановления товара маркета
  return {
    data: { success: true }
  };
};

export const deleteMarketItemPermanently = async (itemId) => {
  // Заглушка для постоянного удаления товара маркета
  return {
    data: { success: true }
  };
};

export const getStatixBonusSettings = async () => {
  // Заглушка для получения настроек статик бонуса
  return {
    data: { enabled: true }
  };
};

export const updateStatixBonusSettings = async (settings) => {
  // Заглушка для обновления настроек статик бонуса
  return {
    data: { success: true }
  };
};

export const getAllBanners = async () => {
  // Заглушка для получения всех баннеров
  return {
    data: []
  };
};

export const createBanner = async (bannerData) => {
  // Заглушка для создания баннера
  return {
    data: { success: true }
  };
};

export const updateBanner = async (bannerId, bannerData) => {
  // Заглушка для обновления баннера
  return {
    data: { success: true }
  };
};

export const deleteBanner = async (bannerId) => {
  // Заглушка для удаления баннера
  return {
    data: { success: true }
  };
};

export const getTotalBalance = async () => {
  // Заглушка для получения общего баланса
  return {
    data: { total: 0 }
  };
};

export const getHourlyActivityStats = async () => {
  // Заглушка для получения статистики почасовой активности
  return {
    data: []
  };
};

export const getPopularItemsStats = async () => {
  // Заглушка для получения статистики популярных товаров
  return {
    data: []
  };
};

export const getGeneralStats = async () => {
  // Заглушка для получения общей статистики
  return {
    data: { users: 0, transactions: 0, revenue: 0 }
  };
};

export const getUserEngagementStats = async () => {
  // Заглушка для получения статистики вовлеченности пользователей
  return {
    data: []
  };
};

export const exportUserEngagement = async () => {
  // Заглушка для экспорта статистики вовлеченности пользователей
  return {
    data: { success: true }
  };
};

export const getInactiveUsers = async () => {
  // Заглушка для получения неактивных пользователей
  return {
    data: []
  };
};

export const getAverageSessionDuration = async () => {
  // Заглушка для получения средней продолжительности сессии
  return {
    data: { duration: 0 }
  };
};

export const getActiveUserRatio = async () => {
  // Заглушка для получения соотношения активных пользователей
  return {
    data: { ratio: 0 }
  };
};

export const getLoginActivityStats = async () => {
  // Заглушка для получения статистики активности входа
  return {
    data: []
  };
};