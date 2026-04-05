-- Интеграция Bitrix24: портал (токены установки) и привязка пользователей портала к users

CREATE TABLE IF NOT EXISTS bitrix_portals (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) NOT NULL UNIQUE,
    member_id VARCHAR(64) NOT NULL UNIQUE,
    access_token TEXT,
    refresh_token TEXT,
    expires_at TIMESTAMP WITH TIME ZONE,
    application_token VARCHAR(255),
    client_endpoint VARCHAR(512),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bitrix_portals_member_id ON bitrix_portals(member_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS bitrix_user_id BIGINT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bitrix_domain VARCHAR(255) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_bitrix_user_portal
    ON users (bitrix_user_id, bitrix_domain)
    WHERE bitrix_user_id IS NOT NULL;
