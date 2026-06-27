-- Phase 5 – Department Modules

DO $$ BEGIN CREATE TYPE dept_req_status AS ENUM ('requested','approved','processing','dispensed','delivered','completed','rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE radiology_modality AS ENUM ('xray','ct','mri','usg','mammography','doppler','fluoroscopy'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lab_status AS ENUM ('sample_pending','sample_collected','processing','report_ready','delivered'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS drug_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  req_number      text UNIQUE NOT NULL DEFAULT 'DR-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  patient_name    text NOT NULL,
  patient_uhid    text,
  bed_id          uuid REFERENCES beds(id) ON DELETE SET NULL,
  medication      text NOT NULL,
  dosage          text,
  frequency       text,
  quantity        text,
  instructions    text,
  is_chemo        boolean NOT NULL DEFAULT false,
  status          dept_req_status NOT NULL DEFAULT 'requested',
  requested_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dispensed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  dispensed_at    timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dr_status_idx ON drug_requests(status);
CREATE INDEX IF NOT EXISTS dr_patient_idx ON drug_requests(patient_uhid);

ALTER TABLE drug_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "dr_select" ON drug_requests; CREATE POLICY "dr_select" ON drug_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "dr_insert" ON drug_requests; CREATE POLICY "dr_insert" ON drug_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "dr_update" ON drug_requests; CREATE POLICY "dr_update" ON drug_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "dr_delete" ON drug_requests; CREATE POLICY "dr_delete" ON drug_requests FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS radiology_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  req_number      text UNIQUE NOT NULL DEFAULT 'RAD-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  patient_name    text NOT NULL,
  patient_uhid    text,
  modality        radiology_modality NOT NULL DEFAULT 'xray',
  body_part       text,
  clinical_notes  text,
  contrast        boolean NOT NULL DEFAULT false,
  status          dept_req_status NOT NULL DEFAULT 'requested',
  requested_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  radiologist_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  report_text     text,
  image_urls      text[] DEFAULT '{}',
  report_url      text,
  scheduled_at    timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rad_status_idx ON radiology_requests(status);
CREATE INDEX IF NOT EXISTS rad_modality_idx ON radiology_requests(modality);

ALTER TABLE radiology_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rad_select" ON radiology_requests; CREATE POLICY "rad_select" ON radiology_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rad_insert" ON radiology_requests; CREATE POLICY "rad_insert" ON radiology_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rad_update" ON radiology_requests; CREATE POLICY "rad_update" ON radiology_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rad_delete" ON radiology_requests; CREATE POLICY "rad_delete" ON radiology_requests FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS lab_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  req_number      text UNIQUE NOT NULL DEFAULT 'LAB-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  patient_name    text NOT NULL,
  patient_uhid    text,
  test_panel      text NOT NULL,
  test_details    text,
  sample_type     text DEFAULT 'Blood',
  status          lab_status NOT NULL DEFAULT 'sample_pending',
  requested_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  collected_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  processed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sample_id       text,
  report_text     text,
  report_url      text,
  collected_at    timestamptz,
  processed_at    timestamptz,
  report_ready_at timestamptz,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lab_status_idx ON lab_requests(status);

ALTER TABLE lab_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "lab_select" ON lab_requests; CREATE POLICY "lab_select" ON lab_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "lab_insert" ON lab_requests; CREATE POLICY "lab_insert" ON lab_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "lab_update" ON lab_requests; CREATE POLICY "lab_update" ON lab_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "lab_delete" ON lab_requests; CREATE POLICY "lab_delete" ON lab_requests FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS chemo_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  req_number      text UNIQUE NOT NULL DEFAULT 'CHEMO-' || to_char(now(),'YYYYMMDD') || '-' || substr(gen_random_uuid()::text,1,6),
  patient_name    text NOT NULL,
  patient_uhid    text,
  drug_name       text NOT NULL,
  cycle_number    int NOT NULL DEFAULT 1,
  dose            text,
  protocol        text,
  status          dept_req_status NOT NULL DEFAULT 'requested',
  requested_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  dispensed_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  dispensed_at    timestamptz,
  scheduled_date  date,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chemo_status_idx ON chemo_requests(status);

ALTER TABLE chemo_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "chemo_select" ON chemo_requests; CREATE POLICY "chemo_select" ON chemo_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chemo_insert" ON chemo_requests; CREATE POLICY "chemo_insert" ON chemo_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "chemo_update" ON chemo_requests; CREATE POLICY "chemo_update" ON chemo_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "chemo_delete" ON chemo_requests; CREATE POLICY "chemo_delete" ON chemo_requests FOR DELETE TO authenticated USING (true);