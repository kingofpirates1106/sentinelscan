-- Production hardening for scan data layer:
-- - Align schemas for scans, anonymous_scans, scan_limits
-- - Enforce strict RLS with no unrestricted policies
-- - Add indexes for query performance

BEGIN;

-- Ensure required extension exists for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- TABLE: scans (authenticated users only)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('url', 'file', 'screenshot')),
  target_value TEXT NOT NULL,
  stats JSONB,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'suspicious', 'dangerous', 'unknown')),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS scan_type TEXT,
  ADD COLUMN IF NOT EXISTS target_value TEXT,
  ADD COLUMN IF NOT EXISTS stats JSONB,
  ADD COLUMN IF NOT EXISTS risk_level TEXT,
  ADD COLUMN IF NOT EXISTS raw_response JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scans'
      AND column_name = 'scan_result'
  ) THEN
    EXECUTE 'UPDATE public.scans SET stats = COALESCE(stats, scan_result)';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scans'
      AND column_name = 'target'
  ) THEN
    EXECUTE 'UPDATE public.scans SET target_value = COALESCE(target_value, target)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TABLE: anonymous_scans (guest scans keyed by session_id)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.anonymous_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('url', 'file', 'screenshot')),
  target_value TEXT NOT NULL,
  stats JSONB,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('safe', 'suspicious', 'dangerous', 'unknown')),
  raw_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.anonymous_scans
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS scan_type TEXT,
  ADD COLUMN IF NOT EXISTS target_value TEXT,
  ADD COLUMN IF NOT EXISTS stats JSONB,
  ADD COLUMN IF NOT EXISTS risk_level TEXT,
  ADD COLUMN IF NOT EXISTS raw_response JSONB,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'anonymous_scans'
      AND column_name = 'scan_result'
  ) THEN
    EXECUTE 'UPDATE public.anonymous_scans SET stats = COALESCE(stats, scan_result)';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- TABLE: scan_limits (rolling 24h counters by user or session)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('url', 'file', 'screenshot')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT scan_limits_owner_check CHECK (
    (user_id IS NOT NULL AND session_id IS NULL) OR
    (user_id IS NULL AND session_id IS NOT NULL)
  )
);

ALTER TABLE public.scan_limits
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS session_id TEXT,
  ADD COLUMN IF NOT EXISTS scan_type TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- ---------------------------------------------------------------------------
-- RLS ENABLEMENT
-- ---------------------------------------------------------------------------
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anonymous_scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_limits ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies on these tables to remove legacy unrestricted rules
DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('scans', 'anonymous_scans', 'scan_limits')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, p.schemaname, p.tablename);
  END LOOP;
END $$;

-- scans: authenticated users can only access their own rows
CREATE POLICY scans_insert_own ON public.scans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY scans_select_own ON public.scans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- anonymous_scans: anon users can only access rows for header-matched session_id
CREATE POLICY anonymous_scans_insert_session ON public.anonymous_scans
  FOR INSERT TO anon
  WITH CHECK (
    session_id = COALESCE(current_setting('request.headers', true)::json->>'x-session-id', '')
    AND session_id <> ''
  );

CREATE POLICY anonymous_scans_select_session ON public.anonymous_scans
  FOR SELECT TO anon
  USING (
    session_id = COALESCE(current_setting('request.headers', true)::json->>'x-session-id', '')
    AND session_id <> ''
  );

-- scan_limits: authenticated by user_id, anon by session_id
CREATE POLICY scan_limits_insert_auth ON public.scan_limits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND session_id IS NULL);

CREATE POLICY scan_limits_select_auth ON public.scan_limits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND session_id IS NULL);

CREATE POLICY scan_limits_insert_session ON public.scan_limits
  FOR INSERT TO anon
  WITH CHECK (
    user_id IS NULL
    AND session_id = COALESCE(current_setting('request.headers', true)::json->>'x-session-id', '')
    AND session_id <> ''
  );

CREATE POLICY scan_limits_select_session ON public.scan_limits
  FOR SELECT TO anon
  USING (
    user_id IS NULL
    AND session_id = COALESCE(current_setting('request.headers', true)::json->>'x-session-id', '')
    AND session_id <> ''
  );

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS scans_user_id_idx ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS scans_created_at_idx ON public.scans(created_at DESC);

CREATE INDEX IF NOT EXISTS anonymous_scans_session_id_idx ON public.anonymous_scans(session_id);
CREATE INDEX IF NOT EXISTS anonymous_scans_created_at_idx ON public.anonymous_scans(created_at DESC);

CREATE INDEX IF NOT EXISTS scan_limits_user_id_idx ON public.scan_limits(user_id);
CREATE INDEX IF NOT EXISTS scan_limits_session_id_idx ON public.scan_limits(session_id);
CREATE INDEX IF NOT EXISTS scan_limits_created_at_idx ON public.scan_limits(created_at DESC);

COMMIT;
