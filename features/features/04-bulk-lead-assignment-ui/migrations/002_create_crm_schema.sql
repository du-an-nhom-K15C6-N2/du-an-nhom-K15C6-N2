CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(100) NOT NULL,
  role VARCHAR(40) NOT NULL CHECK (role IN (
    'admin', 'sales_manager', 'training_manager', 'manager', 'consultant',
    'academic_advisor', 'ACADEMIC_ADVISOR', 'TRAINING_MANAGER'
  )),
  name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  team VARCHAR(100),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  email VARCHAR(254),
  phone VARCHAR(30) NOT NULL,
  source VARCHAR(100),
  status VARCHAR(20) NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'contacted', 'qualified', 'converted', 'lost', 'pending')),
  assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_leads_phone_normalized
  ON leads (regexp_replace(phone, '[^0-9]', '', 'g'));
CREATE INDEX IF NOT EXISTS idx_leads_assigned_created
  ON leads (assigned_to, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status_created
  ON leads (status, created_at DESC);

CREATE TABLE IF NOT EXISTS lead_assignment_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  changed_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  note VARCHAR(1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_assignment_history_lead_created
  ON lead_assignment_history (lead_id, created_at DESC);
