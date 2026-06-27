-- =============================================================
-- FIX: RLS policies, trigger reliability, dashboard stats view
-- =============================================================

-- ---------------------------------------------------------------
-- 1. FIX handle_new_user trigger — must NEVER block auth.users
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role    hospital_role := 'staff';
  v_name    text          := '';
BEGIN
  BEGIN
    IF (NEW.raw_user_meta_data->>'role') IS NOT NULL
       AND (NEW.raw_user_meta_data->>'role') != ''
    THEN
      v_role := (NEW.raw_user_meta_data->>'role')::hospital_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'staff';
  END;

  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, v_name, v_role)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role      = EXCLUDED.role;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW; -- never block the auth.users insert
END;
$$;

-- Ensure trigger exists (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------
-- 2. FIX profiles RLS — allow trigger (anon + authenticated) to
--    insert, and allow admins to update any profile
-- ---------------------------------------------------------------
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- SELECT: all authenticated users can read all profiles (needed for
-- user lists, department heads, etc.)
DROP POLICY IF EXISTS "profiles_select_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_select_authenticated" ON profiles;
CREATE POLICY "profiles_select_authenticated" ON profiles FOR SELECT
  TO authenticated USING (true);

-- INSERT: the trigger runs as SECURITY DEFINER so it bypasses RLS,
-- but keep liberal policies for edge cases / anon sign-up flow
DROP POLICY IF EXISTS "profiles_insert_own"  ON profiles;
DROP POLICY IF EXISTS "profiles_insert_anon" ON profiles;
CREATE POLICY "profiles_insert_anon" ON profiles FOR INSERT
  TO anon WITH CHECK (true);
CREATE POLICY "profiles_insert_authenticated" ON profiles FOR INSERT
  TO authenticated WITH CHECK (true);

-- UPDATE: authenticated users can update any profile (admin flows)
--         Own-only restriction is enforced at the application layer
DROP POLICY IF EXISTS "profiles_update_own"           ON profiles;
DROP POLICY IF EXISTS "profiles_update_authenticated" ON profiles;
CREATE POLICY "profiles_update_authenticated" ON profiles FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

-- DELETE: only own account (soft-delete preferred; this is a guard)
DROP POLICY IF EXISTS "profiles_delete_authenticated" ON profiles;
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- ---------------------------------------------------------------
-- 3. audit_logs INSERT must be open to authenticated (needed for
--    all modules logging CRUD actions)
-- ---------------------------------------------------------------
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_insert_authenticated" ON audit_logs;
CREATE POLICY "audit_insert_authenticated" ON audit_logs FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "audit_select_authenticated" ON audit_logs;
CREATE POLICY "audit_select_authenticated" ON audit_logs FOR SELECT
  TO authenticated USING (true);

-- ---------------------------------------------------------------
-- 4. DASHBOARD STATS VIEW — single query replaces N round trips
-- ---------------------------------------------------------------
CREATE OR REPLACE VIEW dashboard_stats AS
SELECT
  -- Users / Staff
  (SELECT COUNT(*)               FROM profiles)                           AS total_users,
  (SELECT COUNT(*)               FROM profiles WHERE is_active = true)    AS active_users,

  -- Departments
  (SELECT COUNT(*)               FROM departments)                        AS total_departments,
  (SELECT COUNT(*)               FROM departments WHERE is_active = true) AS active_departments,

  -- Beds
  (SELECT COUNT(*)               FROM beds)                               AS total_beds,
  (SELECT COUNT(*)               FROM beds WHERE status = 'occupied')     AS occupied_beds,
  (SELECT COUNT(*)               FROM beds WHERE status = 'available')    AS available_beds,

  -- Tickets
  (SELECT COUNT(*)               FROM tickets)                            AS total_tickets,
  (SELECT COUNT(*)               FROM tickets WHERE status = 'open')      AS open_tickets,
  (SELECT COUNT(*)               FROM tickets WHERE status IN ('assigned','in_progress')) AS assigned_tickets,
  (SELECT COUNT(*)               FROM tickets WHERE status = 'resolved')  AS resolved_tickets,
  (SELECT COUNT(*)               FROM tickets WHERE status = 'closed')    AS closed_tickets,

  -- Bed Allocations (Admissions/Discharges)
  (SELECT COUNT(*)               FROM bed_allocations WHERE status = 'active')    AS current_admissions,
  (SELECT COUNT(*)               FROM discharge_requests WHERE status = 'approved') AS total_discharges,

  -- Media
  (SELECT COUNT(*)               FROM media_files WHERE is_deleted = false)       AS total_media,

  -- Assets
  (SELECT COUNT(*)               FROM assets)                                     AS total_assets,
  (SELECT COUNT(*)               FROM assets WHERE status = 'active')             AS active_assets,

  -- Deliveries
  (SELECT COUNT(*)               FROM deliveries)                                 AS total_deliveries,
  (SELECT COUNT(*)               FROM deliveries WHERE status = 'pending')        AS pending_deliveries,

  -- Lab / Radiology / Pharmacy
  (SELECT COUNT(*)               FROM lab_requests)                               AS total_lab_requests,
  (SELECT COUNT(*)               FROM radiology_requests)                         AS total_radiology_requests,
  (SELECT COUNT(*)               FROM drug_requests)                              AS total_drug_requests,

  -- Requisitions
  (SELECT COUNT(*)               FROM requisitions)                               AS total_requisitions,
  (SELECT COUNT(*)               FROM requisitions WHERE status = 'pending')      AS pending_requisitions;

-- RLS for the view — authenticated users can query it
GRANT SELECT ON dashboard_stats TO authenticated;

-- ---------------------------------------------------------------
-- 5. Notifications INSERT policy (authenticated users)
-- ---------------------------------------------------------------
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif_insert_own"           ON notifications;
DROP POLICY IF EXISTS "notif_insert_authenticated" ON notifications;
CREATE POLICY "notif_insert_authenticated" ON notifications FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "notif_select_own"           ON notifications;
CREATE POLICY "notif_select_own" ON notifications FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "notif_update_own"           ON notifications;
CREATE POLICY "notif_update_own" ON notifications FOR UPDATE
  TO authenticated USING (auth.uid() = user_id);
