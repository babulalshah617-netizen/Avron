
-- Add proof upload support to tickets
ALTER TABLE tickets 
  ADD COLUMN IF NOT EXISTS proof_url TEXT,
  ADD COLUMN IF NOT EXISTS proof_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS proof_uploaded_by UUID REFERENCES auth.users(id);

-- Track resolution duration in seconds
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS resolution_duration_seconds INTEGER;

-- Add "assign to me" timestamp  
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS self_assigned_at TIMESTAMPTZ;

-- Index for faster proof queries
CREATE INDEX IF NOT EXISTS idx_tickets_proof_url ON tickets(proof_url) WHERE proof_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
