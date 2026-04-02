-- Enable Row Level Security and tighten policies for scans and anonymous_scans

-- Scans: only authenticated users can insert/select their own scans
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS scans_insert_any ON public.scans;
DROP POLICY IF EXISTS scans_select_auth_own ON public.scans;
DROP POLICY IF EXISTS scans_select_service ON public.scans;

CREATE POLICY scans_insert_auth ON public.scans
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY scans_select_auth_own ON public.scans
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Anonymous scans: allow insert/select only for matching session_id header
ALTER TABLE public.anonymous_scans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS anonymous_scans_insert_any ON public.anonymous_scans;
DROP POLICY IF EXISTS anonymous_scans_select_any ON public.anonymous_scans;

CREATE POLICY anonymous_scans_insert_session ON public.anonymous_scans
  FOR INSERT TO anon
  WITH CHECK (
    session_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-session-id',
      ''
    )
  );

CREATE POLICY anonymous_scans_select_session ON public.anonymous_scans
  FOR SELECT TO anon
  USING (
    session_id = COALESCE(
      current_setting('request.headers', true)::json->>'x-session-id',
      ''
    )
  );
