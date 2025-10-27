# backend/crud/__init__.py

# Импорты для обратной совместимости
from .users import (
    get_user,
    get_user_by_telegram,
    create_user,
    get_users,
    update_user_profile,
    search_users_by_name,
    get_all_users_for_admin,
    admin_update_user,
    admin_delete_user,
    mark_onboarding_as_seen
)

from .transactions import (
    create_transaction,
    get_feed,
    get_user_transactions,
    get_leaderboard_data,
    get_user_rank,
    get_leaderboards_status
)

from .market import (
    get_market_items,
    get_active_items,
    create_market_item,
    admin_create_market_item,
    admin_update_market_item,
    archive_market_item,
    get_archived_items,
    admin_delete_item_permanently,
    admin_restore_market_item,
    create_purchase,
    calculate_spasibki_price,
    calculate_accumulation_forecast
)

from .admin import (
    add_points_to_all_users,
    add_tickets_to_all_users,
    reset_balances,
    get_active_banners,
    get_all_banners,
    create_banner,
    update_banner,
    delete_banner,
    process_birthday_bonuses,
    update_user_status,
    process_profile_update,
    request_profile_update
)

from .statistics import (
    get_general_statistics,
    get_hourly_activity_stats,
    get_login_activity_stats,
    get_user_engagement_stats,
    get_popular_items_stats,
    get_inactive_users,
    get_total_balance,
    get_active_user_ratio,
    get_average_session_duration
)

from .sessions import (
    start_user_session,
    ping_user_session
)

from .roulette import (
    assemble_tickets,
    spin_roulette,
    get_roulette_history,
    reset_ticket_parts,
    reset_tickets
)

from .cards import (
    process_pkpass_file,
    delete_user_card
)

from .statix_bonus import (
    get_statix_bonus_item,
    create_statix_bonus_item,
    update_statix_bonus_item,
    create_statix_bonus_purchase
)

from .shared_gifts import (
    create_shared_gift_invitation,
    get_shared_gift_invitation,
    accept_shared_gift_invitation,
    reject_shared_gift_invitation,
    refund_shared_gift_purchase,
    get_user_shared_gift_invitations,
    cleanup_expired_shared_gift_invitations
)

from .banners import (
    generate_monthly_leaderboard_banners,
    generate_current_month_test_banners
)

__all__ = [
    # Users
    'get_user', 'get_user_by_telegram', 'create_user', 'get_users',
    'update_user_profile', 'search_users_by_name', 'get_all_users_for_admin',
    'admin_update_user', 'admin_delete_user', 'mark_onboarding_as_seen',
    
    # Transactions
    'create_transaction', 'get_feed', 'get_user_transactions',
    'get_leaderboard_data', 'get_user_rank', 'get_leaderboards_status',
    
    # Market
    'get_market_items', 'get_active_items', 'create_market_item',
    'admin_create_market_item', 'admin_update_market_item', 'archive_market_item',
    'get_archived_items', 'admin_delete_item_permanently', 'admin_restore_market_item',
    'create_purchase', 'calculate_spasibki_price', 'calculate_accumulation_forecast',
    
    # Admin
    'add_points_to_all_users', 'add_tickets_to_all_users', 'reset_balances',
    'get_active_banners', 'get_all_banners', 'create_banner', 'update_banner',
    'delete_banner', 'process_birthday_bonuses', 'update_user_status',
    'process_profile_update', 'request_profile_update',
    
    # Statistics
    'get_general_statistics', 'get_hourly_activity_stats', 'get_login_activity_stats',
    'get_user_engagement_stats', 'get_popular_items_stats', 'get_inactive_users',
    'get_total_balance', 'get_active_user_ratio', 'get_average_session_duration',
    
    # Sessions
    'start_user_session', 'ping_user_session',
    
    # Roulette
    'assemble_tickets', 'spin_roulette', 'get_roulette_history',
    'reset_ticket_parts', 'reset_tickets',
    
    # Cards
    'process_pkpass_file', 'delete_user_card',
    
    # Statix Bonus
    'get_statix_bonus_item', 'create_statix_bonus_item', 'update_statix_bonus_item',
    'create_statix_bonus_purchase',
    
    # Shared Gifts
    'create_shared_gift_invitation', 'get_shared_gift_invitation',
    'accept_shared_gift_invitation', 'reject_shared_gift_invitation',
    'refund_shared_gift_purchase', 'get_user_shared_gift_invitations',
    'cleanup_expired_shared_gift_invitations',
    
    # Banners
    'generate_monthly_leaderboard_banners', 'generate_current_month_test_banners'
]
