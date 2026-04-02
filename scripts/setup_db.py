#!/usr/bin/env python3
import os
import psycopg2
from psycopg2.extras import execute_values

# Get Supabase connection string
db_url = os.getenv("POSTGRES_URL")

if not db_url:
    print("[v0] ERROR: POSTGRES_URL not set")
    exit(1)

try:
    # Connect to database
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    print("[v0] Connected to database")
    
    # Create profiles table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS public.profiles (
      id uuid PRIMARY KEY,
      username text UNIQUE,
      email text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );
    """)
    print("[v0] Created profiles table")
    
    # Enable RLS on profiles
    cursor.execute("ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;")
    
    # Drop existing policies if they exist
    cursor.execute("DROP POLICY IF EXISTS profiles_select_own ON public.profiles;")
    cursor.execute("DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;")
    cursor.execute("DROP POLICY IF EXISTS profiles_update_own ON public.profiles;")
    cursor.execute("DROP POLICY IF EXISTS profiles_delete_own ON public.profiles;")
    
    # Create RLS policies for profiles
    cursor.execute("""
    CREATE POLICY profiles_select_own ON public.profiles
    FOR SELECT USING (auth.uid() = id);
    """)
    cursor.execute("""
    CREATE POLICY profiles_insert_own ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);
    """)
    cursor.execute("""
    CREATE POLICY profiles_update_own ON public.profiles
    FOR UPDATE USING (auth.uid() = id);
    """)
    cursor.execute("""
    CREATE POLICY profiles_delete_own ON public.profiles
    FOR DELETE USING (auth.uid() = id);
    """)
    print("[v0] Created RLS policies for profiles")
    
    # Create scans table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS public.scans (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      scan_type text NOT NULL CHECK (scan_type IN ('url', 'file', 'screenshot')),
      target text NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'scanning', 'completed', 'failed')),
      virustotal_id text,
      created_at timestamp with time zone DEFAULT now(),
      updated_at timestamp with time zone DEFAULT now()
    );
    """)
    print("[v0] Created scans table")
    
    # Enable RLS on scans
    cursor.execute("ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;")
    
    # Drop existing policies if they exist
    cursor.execute("DROP POLICY IF EXISTS scans_select_own ON public.scans;")
    cursor.execute("DROP POLICY IF EXISTS scans_insert_own ON public.scans;")
    cursor.execute("DROP POLICY IF EXISTS scans_update_own ON public.scans;")
    cursor.execute("DROP POLICY IF EXISTS scans_delete_own ON public.scans;")
    
    # Create RLS policies for scans
    cursor.execute("""
    CREATE POLICY scans_select_own ON public.scans
    FOR SELECT USING (auth.uid() = user_id);
    """)
    cursor.execute("""
    CREATE POLICY scans_insert_own ON public.scans
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    """)
    cursor.execute("""
    CREATE POLICY scans_update_own ON public.scans
    FOR UPDATE USING (auth.uid() = user_id);
    """)
    cursor.execute("""
    CREATE POLICY scans_delete_own ON public.scans
    FOR DELETE USING (auth.uid() = user_id);
    """)
    print("[v0] Created RLS policies for scans")
    
    # Create scan_results table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS public.scan_results (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
      user_id uuid NOT NULL,
      harmless_count integer DEFAULT 0,
      malicious_count integer DEFAULT 0,
      suspicious_count integer DEFAULT 0,
      undetected_count integer DEFAULT 0,
      threat_level text CHECK (threat_level IN ('safe', 'suspicious', 'dangerous', 'unknown')),
      details jsonb,
      created_at timestamp with time zone DEFAULT now()
    );
    """)
    print("[v0] Created scan_results table")
    
    # Enable RLS on scan_results
    cursor.execute("ALTER TABLE public.scan_results ENABLE ROW LEVEL SECURITY;")
    
    # Drop existing policies if they exist
    cursor.execute("DROP POLICY IF EXISTS scan_results_select_own ON public.scan_results;")
    cursor.execute("DROP POLICY IF EXISTS scan_results_insert_own ON public.scan_results;")
    cursor.execute("DROP POLICY IF EXISTS scan_results_update_own ON public.scan_results;")
    cursor.execute("DROP POLICY IF EXISTS scan_results_delete_own ON public.scan_results;")
    
    # Create RLS policies for scan_results
    cursor.execute("""
    CREATE POLICY scan_results_select_own ON public.scan_results
    FOR SELECT USING (auth.uid() = user_id);
    """)
    cursor.execute("""
    CREATE POLICY scan_results_insert_own ON public.scan_results
    FOR INSERT WITH CHECK (auth.uid() = user_id);
    """)
    cursor.execute("""
    CREATE POLICY scan_results_update_own ON public.scan_results
    FOR UPDATE USING (auth.uid() = user_id);
    """)
    cursor.execute("""
    CREATE POLICY scan_results_delete_own ON public.scan_results
    FOR DELETE USING (auth.uid() = user_id);
    """)
    print("[v0] Created RLS policies for scan_results")
    
    # Create the trigger function
    cursor.execute("""
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    BEGIN
      INSERT INTO public.profiles (id)
      VALUES (new.id)
      ON CONFLICT (id) DO NOTHING;
      RETURN new;
    END;
    $$;
    """)
    print("[v0] Created trigger function")
    
    # Drop existing trigger if it exists
    cursor.execute("DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;")
    
    # Create the trigger
    cursor.execute("""
    CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();
    """)
    print("[v0] Created auth trigger")
    
    conn.commit()
    print("[v0] Database setup completed successfully!")
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"[v0] ERROR: {str(e)}")
    if conn:
        conn.rollback()
        conn.close()
    exit(1)
