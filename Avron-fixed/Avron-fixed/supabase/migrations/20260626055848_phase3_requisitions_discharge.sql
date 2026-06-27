/*
# Phase 3 – Requisition System & Discharge Workflow

## New Tables
- requisitions: Master table for all requisition types
- requisition_items: Line items for each requisition
- discharge_requests: Nursing → Pharmacy → Billing discharge workflow

## Enums
- requisition_type: ot_medication, chemo_drug, lab, radiology, bed_transfer, bed_change
- workflow_status: created, approved, processing, delivered, completed, rejected
- discharge_status: initiated, pharmacy_cleared, billing_cleared, completed
*/

DO $$ BEGIN CREATE TYPE requisition_type AS ENUM ('ot_medication','chemo_drug','lab','radiology','bed_transfer','bed_change','general'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE workflow_status AS ENUM ('created','approved','processing','delivered','completed','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE discharge_status AS ENUM ('initiated','pharmacy_cleared','billing_cleared','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE req_priority AS ENUM ('routine','urgent','emergency'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS requisitions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  req_number       text UNIQUE NOT NULL DEFAULT 'REQ-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  type             requisition_type NOT NULL,
  status           workflow_status NOT NULL DEFAULT 'created',
  priority         req_priority NOT NULL DEFAULT 'routine',
  patient_name     text,
  patient_uhid     text,
  department_id    uuid REFERENCES departments(id) ON DELETE SET NULL,
  requested_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  delivered_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notes            text,
  scheduled_for    timestamptz,
  approved_at      timestamptz,
  processed_at     timestamptz,
  delivered_at     timestamptz,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS req_status_idx ON requisitions(status);
CREATE INDEX IF NOT EXISTS req_type_idx ON requisitions(type);
CREATE INDEX IF NOT EXISTS req_dept_idx ON requisitions(department_id);

ALTER TABLE requisitions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "req_select" ON requisitions; CREATE POLICY "req_select" ON requisitions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "req_insert" ON requisitions; CREATE POLICY "req_insert" ON requisitions FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "req_update" ON requisitions; CREATE POLICY "req_update" ON requisitions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "req_delete" ON requisitions; CREATE POLICY "req_delete" ON requisitions FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS requisition_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisition_id uuid NOT NULL REFERENCES requisitions(id) ON DELETE CASCADE,
  item_name     text NOT NULL,
  quantity      numeric NOT NULL DEFAULT 1,
  unit          text DEFAULT 'pcs',
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS req_items_req_idx ON requisition_items(requisition_id);

ALTER TABLE requisition_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reqitems_select" ON requisition_items; CREATE POLICY "reqitems_select" ON requisition_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "reqitems_insert" ON requisition_items; CREATE POLICY "reqitems_insert" ON requisition_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "reqitems_update" ON requisition_items; CREATE POLICY "reqitems_update" ON requisition_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "reqitems_delete" ON requisition_items; CREATE POLICY "reqitems_delete" ON requisition_items FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS discharge_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_name      text NOT NULL,
  patient_uhid      text,
  bed_id            uuid REFERENCES beds(id) ON DELETE SET NULL,
  room_id           uuid REFERENCES rooms(id) ON DELETE SET NULL,
  diagnosis         text,
  status            discharge_status NOT NULL DEFAULT 'initiated',
  initiated_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  pharmacy_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  billing_by        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nursing_notes     text,
  pharmacy_notes    text,
  billing_notes     text,
  total_bill        numeric DEFAULT 0,
  pharmacy_cleared_at timestamptz,
  billing_cleared_at  timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS discharge_status_idx ON discharge_requests(status);

ALTER TABLE discharge_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "discharge_select" ON discharge_requests; CREATE POLICY "discharge_select" ON discharge_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "discharge_insert" ON discharge_requests; CREATE POLICY "discharge_insert" ON discharge_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "discharge_update" ON discharge_requests; CREATE POLICY "discharge_update" ON discharge_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "discharge_delete" ON discharge_requests; CREATE POLICY "discharge_delete" ON discharge_requests FOR DELETE TO authenticated USING (true);

DROP TRIGGER IF EXISTS req_updated_at ON requisitions;
CREATE TRIGGER req_updated_at BEFORE UPDATE ON requisitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS discharge_updated_at ON discharge_requests;
CREATE TRIGGER discharge_updated_at BEFORE UPDATE ON discharge_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
