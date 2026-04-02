BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.security_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT,
  link TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL,
  source_url TEXT NOT NULL,
  cover_image TEXT,
  published_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  views INTEGER NOT NULL DEFAULT 0,
  is_new BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS security_articles_published_at_desc_idx
  ON public.security_articles (published_at DESC);

ALTER TABLE public.security_articles ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'security_articles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.security_articles', p.policyname);
  END LOOP;
END $$;

CREATE POLICY security_articles_select_authenticated
  ON public.security_articles
  FOR SELECT TO authenticated
  USING (TRUE);

-- Cron/background writes use service role key; no public write policies.

COMMIT;
