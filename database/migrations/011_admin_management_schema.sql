-- Add soft-delete and last-login tracking to users
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NOT NULL;

-- Audit log for all admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  action_type VARCHAR(100) NOT NULL,
  target_type VARCHAR(50) NOT NULL,
  target_id VARCHAR(255),
  changes JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_admin ON audit_logs(admin_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Chart configuration catalog (admin-managed chart definitions)
CREATE TABLE IF NOT EXISTS chart_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chart_id VARCHAR(100) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  access_tier VARCHAR(50) NOT NULL DEFAULT 'free',
  description TEXT,
  methodology TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_chart_access_tier CHECK (access_tier IN ('free', 'premium')),
  CONSTRAINT check_chart_status CHECK (status IN ('draft', 'active', 'inactive'))
);

CREATE INDEX IF NOT EXISTS idx_chart_configs_status ON chart_configs(status, access_tier);
CREATE INDEX IF NOT EXISTS idx_chart_configs_category ON chart_configs(category);

ALTER TABLE chart_configs ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS set_chart_configs_updated_at ON chart_configs;
CREATE TRIGGER set_chart_configs_updated_at
BEFORE UPDATE ON chart_configs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
