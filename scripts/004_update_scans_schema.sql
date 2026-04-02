-- Drop existing scans table if it exists to recreate with proper schema
-- This is safe as we're in a fresh migration
DROP TABLE IF EXISTS public.scans CASCADE;

-- Create scans table with exact schema requested
-- id: UUID primary key
-- user_id: UUID, nullable for anonymous users
-- scan_type: text ('url', 'file', or 'screenshot')
-- target_value: text for URL or filename/hash
-- scan_result: JSON for full VirusTotal response
-- risk_level: text ('safe', 'suspicious', 'malicious')
-- is_anonymous: boolean flag for anonymous scans
-- created_at: timestamp with timezone
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('url', 'file', 'screenshot')),
  target_value TEXT NOT NULL,
  scan_result JSONB,
  risk_level TEXT CHECK (risk_level IN ('safe', 'suspicious', 'malicious', 'unknown')),
  is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Authenticated users can only insert their own scans
CREATE POLICY "scans_insert_auth_own" ON public.scans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT is_anonymous);

-- RLS Policy: Authenticated users can only read their own scans
CREATE POLICY "scans_select_auth_own" ON public.scans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND NOT is_anonymous);

-- Create indexes for performance
CREATE INDEX scans_user_id_idx ON public.scans(user_id);
CREATE INDEX scans_created_at_idx ON public.scans(created_at DESC);
CREATE INDEX scans_is_anonymous_idx ON public.scans(is_anonymous);
CREATE INDEX scans_scan_type_idx ON public.scans(scan_type);
