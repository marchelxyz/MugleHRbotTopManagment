// types/api.ts

export interface User {
  id: number;
  telegram_id: number;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  username?: string;
  is_admin: boolean;
  telegram_photo_url?: string;
  phone_number?: string;
  date_of_birth?: string;
  balance: number;
  ticket_parts: number;
  tickets: number;
  last_login_date: string;
  has_seen_onboarding: boolean;
  card_barcode?: string;
  card_balance?: number;
  status: 'pending' | 'approved' | 'rejected' | 'blocked' | 'deleted';
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: number;
  sender_id: number;
  receiver_id: number;
  amount: number;
  message?: string;
  timestamp: string;
  sender?: User;
  receiver?: User;
}

export interface MarketItem {
  id: number;
  name: string;
  description: string;
  price_rubles: number;
  price_spasibki: number;
  is_active: boolean;
  auto_issue: boolean;
  is_shared_gift: boolean;
  created_at: string;
  updated_at: string;
  item_codes?: ItemCode[];
}

export interface ItemCode {
  id: number;
  item_id: number;
  purchase_id: number;
  code: string;
  is_used: boolean;
  created_at: string;
}

export interface Purchase {
  id: number;
  user_id: number;
  item_id: number;
  amount: number;
  is_statix_bonus: boolean;
  statix_amount?: number;
  is_shared_gift: boolean;
  shared_gift_invitation_id?: number;
  timestamp: string;
  user?: User;
  item?: MarketItem;
}

export interface Banner {
  id: number;
  text: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RouletteWin {
  id: number;
  user_id: number;
  prize_name: string;
  prize_amount: number;
  timestamp: string;
  user?: User;
}

export interface UserSession {
  id: number;
  user_id: number;
  start_time: string;
  end_time?: string;
  last_ping: string;
  user?: User;
}

export interface StatixBonusItem {
  id: number;
  name: string;
  description: string;
  thanks_to_statix_rate: number;
  min_bonus_per_step: number;
  max_bonus_per_step: number;
  bonus_step: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SharedGiftInvitation {
  id: number;
  item_id: number;
  creator_id: number;
  accepted_by_id?: number;
  rejected_by_id?: number;
  invitation_code: string;
  max_participants: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expires_at: string;
  created_at: string;
  item?: MarketItem;
  creator?: User;
  accepted_by?: User;
}

export interface PendingUpdate {
  id: number;
  user_id: number;
  update_data: Record<string, any>;
  created_at: string;
  user?: User;
}

// API Request/Response types
export interface RegisterRequest {
  telegram_id: number;
  first_name: string;
  last_name: string;
  position: string;
  department: string;
  username?: string;
  telegram_photo_url?: string;
  phone_number?: string;
  date_of_birth?: string;
}

export interface UserUpdate {
  first_name?: string;
  last_name?: string;
  position?: string;
  department?: string;
  phone_number?: string;
  date_of_birth?: string;
}

export interface AdminUserUpdate extends UserUpdate {
  status?: string;
  is_admin?: boolean;
  balance?: number;
  ticket_parts?: number;
  tickets?: number;
}

export interface TransactionCreate {
  receiver_telegram_id: number;
  amount: number;
  message?: string;
}

export interface PurchaseCreate {
  item_id: number;
}

export interface MarketItemCreate {
  name: string;
  description: string;
  price_rubles: number;
  price_spasibki: number;
  auto_issue: boolean;
  is_shared_gift: boolean;
}

export interface MarketItemUpdate {
  name?: string;
  description?: string;
  price_rubles?: number;
  price_spasibki?: number;
  is_active?: boolean;
  auto_issue?: boolean;
  is_shared_gift?: boolean;
}

export interface BannerCreate {
  text: string;
  is_active: boolean;
}

export interface BannerUpdate {
  text?: string;
  is_active?: boolean;
}

export interface StatixBonusItemCreate {
  name: string;
  description: string;
  thanks_to_statix_rate: number;
  min_bonus_per_step: number;
  max_bonus_per_step: number;
  bonus_step: number;
  is_active: boolean;
}

export interface StatixBonusItemUpdate {
  name?: string;
  description?: string;
  thanks_to_statix_rate?: number;
  min_bonus_per_step?: number;
  max_bonus_per_step?: number;
  bonus_step?: number;
  is_active?: boolean;
}

export interface StatixBonusPurchaseRequest {
  amount: number;
}

export interface StatixBonusPurchaseResponse {
  success: boolean;
  purchase_id?: number;
  amount?: number;
  spasibki_price?: number;
  message?: string;
}

export interface CreateSharedGiftInvitationRequest {
  item_id: number;
  max_participants: number;
}

export interface AcceptSharedGiftRequest {
  invitation_id: number;
}

export interface RejectSharedGiftRequest {
  invitation_id: number;
}

export interface SharedGiftInvitationActionResponse {
  success: boolean;
  message?: string;
  purchase_id?: number;
}

// Statistics types
export interface GeneralStatsResponse {
  total_users: number;
  active_users: number;
  total_balance: number;
  transactions_count: number;
  purchases_count: number;
}

export interface HourlyActivityStats {
  hour: number;
  count: number;
}

export interface LoginActivityStats {
  date: string;
  logins: number;
}

export interface UserEngagementStats {
  users_with_transactions: number;
  users_with_purchases: number;
  total_users: number;
  transaction_engagement_rate: number;
  purchase_engagement_rate: number;
}

export interface PopularItemsStats {
  name: string;
  price_spasibki: number;
  purchases_count: number;
  total_revenue: number;
}

export interface ActiveUserRatio {
  active_users: number;
  total_users: number;
  ratio: number;
}

export interface AverageSessionDuration {
  avg_duration_seconds: number;
  avg_duration_minutes: number;
  avg_duration_hours: number;
}

// Leaderboard types
export interface LeaderboardEntry {
  id: number;
  first_name: string;
  last_name: string;
  telegram_photo_url?: string;
  total_received?: number;
  total_sent?: number;
}

export interface LeaderboardStatus {
  current_month: {
    transactions_count: number;
    has_data: boolean;
  };
  last_month: {
    transactions_count: number;
    has_data: boolean;
  };
}
