-- Create scans table for all scan records (including anonymous scans)
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  session_id TEXT,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('url', 'file', 'screenshot')),
  target TEXT NOT NULL,
  result_summary JSONB,
  risk_level TEXT CHECK (risk_level IN ('safe', 'suspicious', 'dangerous', 'unknown')),
  raw_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can insert their own scans only
CREATE POLICY "scans_insert_own" ON public.scans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can view their own scans (logged in with user_id)
-- Note: Anonymous users can view their scans via session_id through app logic
CREATE POLICY "scans_select_own" ON public.scans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can update their own scans
CREATE POLICY "scans_update_own" ON public.scans
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own scans
CREATE POLICY "scans_delete_own" ON public.scans
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS scans_user_id_idx ON public.scans(user_id);
CREATE INDEX IF NOT EXISTS scans_session_id_idx ON public.scans(session_id);
CREATE INDEX IF NOT EXISTS scans_created_at_idx ON public.scans(created_at);
