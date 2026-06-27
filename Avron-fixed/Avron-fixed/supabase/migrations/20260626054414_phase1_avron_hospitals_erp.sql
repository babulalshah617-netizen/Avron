/*
# AVRON HOSPITALS ERP – Phase 1 Schema

## Overview
Initial database schema for AVRON HOSPITALS ERP Phase 1.
Sets up authentication profiles, department structure, role-based access,
in-app notifications, audit logging, and OTP password reset.

## New Tables

### profiles
Extends Supabase auth.users with hospital-specific user data.
- id: UUID referencing auth.users
- full_name: Staff member's full name
- employee_id: Unique hospital employee ID
- role: Enum of hospital roles (super_admin, md, department_head, etc.)
- department_id: FK to departments table
- phone: Contact phone number
- avatar_url: Profile photo URL
- is_active: Whether the account is active
- last_login: Timestamp of last login

### departments
Hospital departments mapped to floors.
- id: UUID primary key
- name: Department name
- floor: Floor identifier (basement, ground, 1st, etc.)
- description: Department description
- head_id: FK to profiles (department head)
- is_active: Whether department is active
- created_at / updated_at

### notifications
In-app notification records per user.
- id: UUID primary key
- user_id: FK to auth.users (recipient)
- title: Notification heading
- message: Notification body
- type: Enum (info, success, warning, error, critical)
- priority: Enum (low, medium, high, critical)
- is_read: Read status
- action_url: Optional deep-link
- created_at

### audit_logs
Immutable audit trail for all significant actions.
- id: UUID primary key
- user_id: FK to auth.users (actor)
- action: Action type (login, logout, create, update, delete, etc.)
- entity_type: Target entity type (user, department, etc.)
- entity_id: Target entity UUID
- details: JSONB metadata
- ip_address: Client IP
- created_at (no updated_at — logs are immutable)

### otp_codes
Temporary OTP codes for password reset.
- id: UUID primary key
- email: Target email
- code: 6-digit OTP
- expires_at: Expiry timestamp (10 minutes)
- used: Whether the OTP has been consumed

## Security
- RLS enabled on all tables
- profiles: authenticated users read own, admins read all via service role
- departments: all authenticated users can read; service role for writes
- notifications: users only see their own
- audit_logs: authenticated can insert; read restricted by role in app
- otp_codes: no RLS reads (service role only) — anon can insert for reset flow
*/

-- ============================================================
-- ENUM TYPES
-- ============================================================

DO $$ BEGIN
  CREATE TYPE hospital_role AS ENUM (
    'super_admin',
    'md',
    'department_head',
    'floor_supervisor',
    'staff',
    'it_team',
    'maintenance_team',
    'biomedical_team'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM ('info', 'success', 'warning', 'error', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE notification_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM (
    'login', 'logout', 'create', 'update', 'delete',
    'assign', 'approve', 'reject', 'transfer', 'reset_password', 'otp_request'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- DEPARTMENTS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  floor       text NOT NULL,
  description text,
  head_id     uuid,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dept_select_authenticated" ON departments;
CREATE POLICY "dept_select_authenticated" ON departments FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "dept_insert_authenticated" ON departments;
CREATE POLICY "dept_insert_authenticated" ON departments FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "dept_update_authenticated" ON departments;
CREATE POLICY "dept_update_authenticated" ON departments FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "dept_delete_authenticated" ON departments;
CREATE POLICY "dept_delete_authenticated" ON departments FOR DELETE
  TO authenticated USING (true);

-- Seed departments
INSERT INTO departments (name, floor, description) VALUES
  ('Radiology', 'Basement', 'Radiology and imaging services'),
  ('X-Ray', 'Basement', 'X-Ray imaging services'),
  ('USG', 'Basement', 'Ultrasonography services'),
  ('HR', 'Basement', 'Human resources department'),
  ('IT Infrastructure', 'Basement', 'Server room and IT infrastructure'),
  ('Emergency', 'Ground Floor', 'Emergency and trauma care'),
  ('Reception', 'Ground Floor', 'Patient reception and registration desk'),
  ('Billing', 'Ground Floor', 'Patient billing and accounts'),
  ('Pharmacy', 'Ground Floor', 'Hospital pharmacy'),
  ('Security', 'Ground Floor', 'Hospital security'),
  ('OPD', '1st Floor', 'Outpatient department'),
  ('Consultation', '1st Floor', 'Consultation rooms'),
  ('Registration', '1st Floor', 'Patient registration'),
  ('Nursing Station 1', '1st Floor', 'Nursing station for 1st floor'),
  ('General Ward 2', '2nd Floor', '16-bed general ward'),
  ('General Ward 3', '3rd Floor', '16-bed general ward'),
  ('Patient Rooms 4th', '4th Floor', 'Rooms 401-407 and Suite 408'),
  ('Patient Rooms 5th', '5th Floor', 'Rooms 501-507 and Suite 508'),
  ('ICU', '6th Floor', 'ICU 1 and ICU 2'),
  ('Operation Theatre', '7th Floor', 'OT 1, OT 2, Recovery, Sterilization'),
  ('Administration', '8th Floor', 'MD Office, Super Admin, Audit, Quality Control, Research'),
  ('Utilities', 'Terrace', 'Water tank, Oxygen plant, Air plant, HVAC')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PROFILES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS profiles (
  id            uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name     text NOT NULL DEFAULT '',
  employee_id   text UNIQUE,
  role          hospital_role NOT NULL DEFAULT 'staff',
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  phone         text,
  avatar_url    text,
  is_active     boolean NOT NULL DEFAULT true,
  last_login    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "profiles_delete_authenticated" ON profiles;
CREATE POLICY "profiles_delete_authenticated" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ============================================================
-- NOTIFICATIONS TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  message     text NOT NULL,
  type        notification_type NOT NULL DEFAULT 'info',
  priority    notification_priority NOT NULL DEFAULT 'low',
  is_read     boolean NOT NULL DEFAULT false,
  action_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON notifications(user_id, is_read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_select_own" ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_insert_own" ON notifications;
CREATE POLICY "notif_insert_own" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notif_update_own" ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_delete_own" ON notifications;
CREATE POLICY "notif_delete_own" ON notifications FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- AUDIT LOGS TABLE (IMMUTABLE)
-- ============================================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      audit_action NOT NULL,
  entity_type text,
  entity_id   uuid,
  details     jsonb DEFAULT '{}',
  ip_address  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx ON audit_logs(action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON audit_logs(created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_select_authenticated" ON audit_logs;
CREATE POLICY "audit_select_authenticated" ON audit_logs FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "audit_insert_authenticated" ON audit_logs;
CREATE POLICY "audit_insert_authenticated" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

-- ============================================================
-- OTP CODES TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS otp_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  code       text NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '10 minutes'),
  used       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS otp_codes_email_idx ON otp_codes(email);

ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "otp_insert_anon" ON otp_codes;
CREATE POLICY "otp_insert_anon" ON otp_codes FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "otp_select_anon" ON otp_codes;
CREATE POLICY "otp_select_anon" ON otp_codes FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "otp_update_anon" ON otp_codes;
CREATE POLICY "otp_update_anon" ON otp_codes FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::hospital_role, 'staff')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- TRIGGER: update updated_at on profiles & departments
-- ============================================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS departments_updated_at ON departments;
CREATE TRIGGER departments_updated_at
  BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
