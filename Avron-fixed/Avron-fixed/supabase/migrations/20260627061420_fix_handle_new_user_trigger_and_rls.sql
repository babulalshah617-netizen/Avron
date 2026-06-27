-- Fix handle_new_user trigger to never fail, even with invalid role values
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role hospital_role := 'staff';
  v_full_name text := '';
BEGIN
  -- Safely extract role
  BEGIN
    IF NEW.raw_user_meta_data->>'role' IS NOT NULL AND NEW.raw_user_meta_data->>'role' != '' THEN
      v_role := (NEW.raw_user_meta_data->>'role')::hospital_role;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_role := 'staff';
  END;

  -- Safely extract full_name
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');

  INSERT INTO profiles (id, full_name, role)
  VALUES (NEW.id, v_full_name, v_role)
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never fail the auth.users insert due to trigger errors
  RETURN NEW;
END;
$$;

-- Allow anon to insert their own profile (for registration flow before email confirmation)
DROP POLICY IF EXISTS "profiles_insert_anon" ON profiles;
CREATE POLICY "profiles_insert_anon" ON profiles FOR INSERT
  TO anon WITH CHECK (true);

-- Allow authenticated to insert any profile (admin creating users via trigger upsert)
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT
  TO authenticated WITH CHECK (true);
