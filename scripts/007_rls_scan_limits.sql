-- Enable Row Level Security and set policies for scan_limits

ALTER TABLE public.scan_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scan_limits_insert_auth ON public.scan_limits;
DROP POLICY IF EXISTS scan_limits_select_auth_own ON public.scan_limits;
DROP POLICY IF EXISTS scan_limits_insert_session ON public.scan_limits;
DROP POLICY IF EXISTS scan_limits_select_session ON public.scan_limits;

-- Authenticated users can insert/select their own limits by user_id
CREATE POLICY scan_limits_insert_auth ON public.scan_limits
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY scan_limits_select_auth_own ON public.scan_limits
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Anonymous users can insert/select by session_id header
CREATE POLICY scan_limits_insert_session ON public.scan_limits
  FOR INSERT TO anon
  WITH CHECK (
    session_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-session-id',
      ''
    )
  );

CREATE POLICY scan_limits_select_session ON public.scan_limits
  FOR SELECT TO anon
  USING (
    session_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-session-id',
      ''
    )
  );
