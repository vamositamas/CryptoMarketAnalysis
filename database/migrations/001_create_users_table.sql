CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  language_preference VARCHAR(10) NOT NULL DEFAULT 'en',
  role VARCHAR(50) NOT NULL DEFAULT 'free_user',
  email_verified BOOLEAN NOT NULL DEFAULT false,
  oauth_provider VARCHAR(50),
  oauth_provider_id VARCHAR(255),
  onboarding_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT users_language_preference_check CHECK (language_preference IN ('en', 'hu')),
  CONSTRAINT users_role_check CHECK (role IN ('administrator', 'premium_user', 'free_user')),
  CONSTRAINT users_email_lowercase_check CHECK (email = lower(email)),
  CONSTRAINT users_password_or_oauth_check CHECK (
    password_hash IS NOT NULL
    OR (oauth_provider IS NOT NULL AND oauth_provider_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_oauth_provider_id ON users(oauth_provider, oauth_provider_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_users_updated_at ON users;
CREATE TRIGGER set_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
