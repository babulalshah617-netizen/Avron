/*
# Phase 2 – Bed & Room Management

## New Tables
- rooms: Physical rooms per floor with type and capacity
- beds: Individual beds within rooms with real-time status
- bed_allocations: Patient-bed assignment history
- bed_transfer_requests: Requests to move a patient between beds

## Enums
- bed_status: available, occupied, maintenance, reserved
- room_type: general_ward, private_room, suite, icu, ot, recovery
- transfer_request_status: pending, approved, rejected, completed
*/

DO $$ BEGIN CREATE TYPE bed_status AS ENUM ('available','occupied','maintenance','reserved'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE room_type AS ENUM ('general_ward','private_room','suite','icu','ot','recovery','nursing_station','other'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transfer_status AS ENUM ('pending','approved','rejected','completed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_number   text NOT NULL,
  floor         text NOT NULL,
  room_type     room_type NOT NULL DEFAULT 'general_ward',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  total_beds    int NOT NULL DEFAULT 1,
  description   text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rooms_floor_idx ON rooms(floor);

ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "rooms_select" ON rooms; CREATE POLICY "rooms_select" ON rooms FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "rooms_insert" ON rooms; CREATE POLICY "rooms_insert" ON rooms FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "rooms_update" ON rooms; CREATE POLICY "rooms_update" ON rooms FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "rooms_delete" ON rooms; CREATE POLICY "rooms_delete" ON rooms FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS beds (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  bed_number     text NOT NULL,
  status         bed_status NOT NULL DEFAULT 'available',
  patient_name   text,
  patient_uhid   text,
  admitted_at    timestamptz,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS beds_room_id_idx ON beds(room_id);
CREATE INDEX IF NOT EXISTS beds_status_idx ON beds(status);

ALTER TABLE beds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "beds_select" ON beds; CREATE POLICY "beds_select" ON beds FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "beds_insert" ON beds; CREATE POLICY "beds_insert" ON beds FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "beds_update" ON beds; CREATE POLICY "beds_update" ON beds FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "beds_delete" ON beds; CREATE POLICY "beds_delete" ON beds FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS bed_allocations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bed_id         uuid NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  room_id        uuid NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  patient_name   text NOT NULL,
  patient_uhid   text,
  age            int,
  gender         text,
  diagnosis      text,
  allocated_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  discharged_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  allocated_at   timestamptz NOT NULL DEFAULT now(),
  discharged_at  timestamptz,
  notes          text
);
CREATE INDEX IF NOT EXISTS bed_alloc_bed_idx ON bed_allocations(bed_id);

ALTER TABLE bed_allocations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "balloc_select" ON bed_allocations; CREATE POLICY "balloc_select" ON bed_allocations FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "balloc_insert" ON bed_allocations; CREATE POLICY "balloc_insert" ON bed_allocations FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "balloc_update" ON bed_allocations; CREATE POLICY "balloc_update" ON bed_allocations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "balloc_delete" ON bed_allocations; CREATE POLICY "balloc_delete" ON bed_allocations FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS bed_transfer_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_bed_id    uuid NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  to_bed_id      uuid NOT NULL REFERENCES beds(id) ON DELETE CASCADE,
  patient_name   text NOT NULL,
  reason         text,
  requested_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status         transfer_status NOT NULL DEFAULT 'pending',
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE bed_transfer_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "btr_select" ON bed_transfer_requests; CREATE POLICY "btr_select" ON bed_transfer_requests FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "btr_insert" ON bed_transfer_requests; CREATE POLICY "btr_insert" ON bed_transfer_requests FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "btr_update" ON bed_transfer_requests; CREATE POLICY "btr_update" ON bed_transfer_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "btr_delete" ON bed_transfer_requests; CREATE POLICY "btr_delete" ON bed_transfer_requests FOR DELETE TO authenticated USING (true);

-- Seed rooms
INSERT INTO rooms (room_number, floor, room_type, total_beds, description) VALUES
  ('Ward-2A', '2nd Floor', 'general_ward', 8, 'General ward 2A - 8 beds'),
  ('Ward-2B', '2nd Floor', 'general_ward', 8, 'General ward 2B - 8 beds'),
  ('Ward-3A', '3rd Floor', 'general_ward', 8, 'General ward 3A - 8 beds'),
  ('Ward-3B', '3rd Floor', 'general_ward', 8, 'General ward 3B - 8 beds'),
  ('401', '4th Floor', 'private_room', 1, 'Private room 401'),
  ('402', '4th Floor', 'private_room', 1, 'Private room 402'),
  ('403', '4th Floor', 'private_room', 1, 'Private room 403'),
  ('404', '4th Floor', 'private_room', 1, 'Private room 404'),
  ('405', '4th Floor', 'private_room', 1, 'Private room 405'),
  ('406', '4th Floor', 'private_room', 1, 'Private room 406'),
  ('407', '4th Floor', 'private_room', 1, 'Private room 407'),
  ('408-Suite', '4th Floor', 'suite', 1, 'Suite 408'),
  ('501', '5th Floor', 'private_room', 1, 'Private room 501'),
  ('502', '5th Floor', 'private_room', 1, 'Private room 502'),
  ('503', '5th Floor', 'private_room', 1, 'Private room 503'),
  ('504', '5th Floor', 'private_room', 1, 'Private room 504'),
  ('505', '5th Floor', 'private_room', 1, 'Private room 505'),
  ('506', '5th Floor', 'private_room', 1, 'Private room 506'),
  ('507', '5th Floor', 'private_room', 1, 'Private room 507'),
  ('508-Suite', '5th Floor', 'suite', 1, 'Suite 508'),
  ('ICU-1', '6th Floor', 'icu', 6, 'ICU 1 - 6 beds'),
  ('ICU-2', '6th Floor', 'icu', 6, 'ICU 2 - 6 beds'),
  ('OT-1', '7th Floor', 'ot', 1, 'Operation Theatre 1'),
  ('OT-2', '7th Floor', 'ot', 1, 'Operation Theatre 2'),
  ('Recovery', '7th Floor', 'recovery', 4, 'Recovery area - 4 bays')
ON CONFLICT DO NOTHING;

-- Seed beds for Ward-2A (8 beds)
DO $$
DECLARE ward2a_id uuid;
BEGIN
  SELECT id INTO ward2a_id FROM rooms WHERE room_number = 'Ward-2A' LIMIT 1;
  IF ward2a_id IS NOT NULL THEN
    INSERT INTO beds (room_id, bed_number) SELECT ward2a_id, 'B-' || gs FROM generate_series(1,8) gs
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE ward2b_id uuid;
BEGIN
  SELECT id INTO ward2b_id FROM rooms WHERE room_number = 'Ward-2B' LIMIT 1;
  IF ward2b_id IS NOT NULL THEN
    INSERT INTO beds (room_id, bed_number) SELECT ward2b_id, 'B-' || gs FROM generate_series(1,8) gs
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE ward3a_id uuid;
BEGIN
  SELECT id INTO ward3a_id FROM rooms WHERE room_number = 'Ward-3A' LIMIT 1;
  IF ward3a_id IS NOT NULL THEN
    INSERT INTO beds (room_id, bed_number) SELECT ward3a_id, 'B-' || gs FROM generate_series(1,8) gs
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

DO $$
DECLARE ward3b_id uuid;
BEGIN
  SELECT id INTO ward3b_id FROM rooms WHERE room_number = 'Ward-3B' LIMIT 1;
  IF ward3b_id IS NOT NULL THEN
    INSERT INTO beds (room_id, bed_number) SELECT ward3b_id, 'B-' || gs FROM generate_series(1,8) gs
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Single-bed rooms (4th and 5th floor)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id, room_number FROM rooms WHERE floor IN ('4th Floor','5th Floor') LOOP
    INSERT INTO beds (room_id, bed_number) VALUES (r.id, 'B-1')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- ICU beds
DO $$
DECLARE icu1_id uuid; icu2_id uuid;
BEGIN
  SELECT id INTO icu1_id FROM rooms WHERE room_number = 'ICU-1' LIMIT 1;
  SELECT id INTO icu2_id FROM rooms WHERE room_number = 'ICU-2' LIMIT 1;
  IF icu1_id IS NOT NULL THEN
    INSERT INTO beds (room_id, bed_number) SELECT icu1_id, 'ICU1-B' || gs FROM generate_series(1,6) gs ON CONFLICT DO NOTHING;
  END IF;
  IF icu2_id IS NOT NULL THEN
    INSERT INTO beds (room_id, bed_number) SELECT icu2_id, 'ICU2-B' || gs FROM generate_series(1,6) gs ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Recovery bays
DO $$
DECLARE rec_id uuid;
BEGIN
  SELECT id INTO rec_id FROM rooms WHERE room_number = 'Recovery' LIMIT 1;
  IF rec_id IS NOT NULL THEN
    INSERT INTO beds (room_id, bed_number) SELECT rec_id, 'REC-' || gs FROM generate_series(1,4) gs ON CONFLICT DO NOTHING;
  END IF;
END $$;

DROP TRIGGER IF EXISTS rooms_updated_at ON rooms;
CREATE TRIGGER rooms_updated_at BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS beds_updated_at ON beds;
CREATE TRIGGER beds_updated_at BEFORE UPDATE ON beds FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS btr_updated_at ON bed_transfer_requests;
CREATE TRIGGER btr_updated_at BEFORE UPDATE ON bed_transfer_requests FOR EACH ROW EXECUTE FUNCTION set_updated_at();
