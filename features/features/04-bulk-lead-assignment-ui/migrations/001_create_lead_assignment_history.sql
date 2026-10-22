CREATE TABLE lead_assignment_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES leads(id),
  from_user_id UUID NULL REFERENCES users(id),
  to_user_id UUID NOT NULL REFERENCES users(id),
  changed_by UUID NOT NULL REFERENCES users(id),
  note VARCHAR(1000) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_assignment_history_lead_created
  ON lead_assignment_history (lead_id, created_at DESC);
