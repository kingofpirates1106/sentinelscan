-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key,
  username text unique,
  email text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles for select using (auth.uid() = id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = id);

-- Create scans table (URL and file scans)
create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  scan_type text not null check (scan_type in ('url', 'file')), -- 'url' or 'file'
  target text not null, -- URL or file hash
  status text not null default 'pending' check (status in ('pending', 'scanning', 'completed', 'failed')),
  virustotal_id text, -- VirusTotal scan ID
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

alter table public.scans enable row level security;

create policy "scans_select_own" on public.scans for select using (auth.uid() = user_id);
create policy "scans_insert_own" on public.scans for insert with check (auth.uid() = user_id);
create policy "scans_update_own" on public.scans for update using (auth.uid() = user_id);
create policy "scans_delete_own" on public.scans for delete using (auth.uid() = user_id);

-- Create scan_results table
create table if not exists public.scan_results (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  user_id uuid not null,
  harmless_count integer default 0,
  malicious_count integer default 0,
  suspicious_count integer default 0,
  undetected_count integer default 0,
  threat_level text check (threat_level in ('safe', 'suspicious', 'dangerous', 'unknown')),
  details jsonb, -- Full VirusTotal response
  created_at timestamp with time zone default now()
);

alter table public.scan_results enable row level security;

create policy "scan_results_select_own" on public.scan_results for select using (auth.uid() = user_id);
create policy "scan_results_insert_own" on public.scan_results for insert with check (auth.uid() = user_id);
create policy "scan_results_update_own" on public.scan_results for update using (auth.uid() = user_id);
create policy "scan_results_delete_own" on public.scan_results for delete using (auth.uid() = user_id);
