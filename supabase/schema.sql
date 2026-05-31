-- ACL — Cricket League Player Registration
-- Supabase schema: tables, enums, indexes, RLS policies, and storage buckets.
--
-- Apply this in the Supabase SQL editor (Dashboard > SQL Editor > New query)
-- or via the Supabase CLI: `supabase db push`.
--
-- Idempotent where practical: re-running should not error on existing objects.

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────
do $$ begin
  create type player_role as enum ('Batsman', 'Bowler', 'All-rounder');
exception when duplicate_object then null; end $$;

do $$ begin
  create type player_status as enum ('Pending', 'Verified', 'Rejected');
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- players table
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.players (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null check (char_length(full_name) between 2 and 120),
  role                   player_role not null,
  phone                  text not null check (phone ~ '^[+0-9 \-]{7,20}$'),
  city                   text not null check (char_length(city) between 2 and 80),
  profile_picture_url    text,
  payment_screenshot_url text,
  utr_number             text check (utr_number is null or char_length(utr_number) between 6 and 30),
  status                 player_status not null default 'Pending',
  paid_at                timestamptz,
  created_at             timestamptz   not null default now(),
  updated_at             timestamptz   not null default now()
);

create index if not exists players_status_idx     on public.players (status);
create index if not exists players_created_at_idx on public.players (created_at desc);
create index if not exists players_phone_idx      on public.players (phone);
create index if not exists players_paid_at_idx    on public.players (paid_at) where paid_at is not null;

-- One UTR per registration. Partial index: many NULLs allowed, but every
-- non-null UTR must be unique across the table.
create unique index if not exists players_utr_number_unique
  on public.players (utr_number)
  where utr_number is not null;

-- Keep updated_at fresh on row updates
create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();

-- Anon-callable existence check so the form can warn users before uploads.
create or replace function public.utr_exists(p_utr text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(select 1 from public.players where utr_number = p_utr);
$$;
revoke all on function public.utr_exists(text) from public;
grant execute on function public.utr_exists(text) to anon, authenticated;

-- Phone-number deduplication. Last 10 digits become the canonical key,
-- so "+91 9999912345" and "9999912345" collide as the same player.
create or replace function public.phone_normalized(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 10);
$$;

create unique index if not exists players_phone_normalized_unique
  on public.players (public.phone_normalized(phone));

create or replace function public.phone_exists(p_phone text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1
    from public.players
    where public.phone_normalized(phone) = public.phone_normalized(p_phone)
  );
$$;
revoke all on function public.phone_exists(text) from public;
grant execute on function public.phone_exists(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
--
-- Model:
--   • Anonymous visitors (the registration form) may INSERT a new player row.
--   • Nobody anonymous may read, update, or delete.
--   • Authenticated users (admins logged in via Supabase Auth) may read all
--     rows and update the `status` (and other fields if needed).
--
-- For a stricter model you can layer an `admins` table check on top — see the
-- commented-out "is_admin()" pattern at the bottom.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.players enable row level security;

drop policy if exists "players_insert_anon" on public.players;
create policy "players_insert_anon"
  on public.players
  for insert
  to anon, authenticated
  with check (
    -- Anyone submitting the form may only create rows in 'Pending' state
    status = 'Pending'
  );

drop policy if exists "players_select_authenticated" on public.players;
create policy "players_select_authenticated"
  on public.players
  for select
  to authenticated
  using (true);

drop policy if exists "players_update_authenticated" on public.players;
create policy "players_update_authenticated"
  on public.players
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "players_delete_authenticated" on public.players;
create policy "players_delete_authenticated"
  on public.players
  for delete
  to authenticated
  using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage buckets
--
-- Two buckets:
--   • profile-pictures   — public read (used in admin table thumbnails)
--   • payment-screenshots — PRIVATE; only authenticated users (admins) can read
--
-- Both allow anonymous INSERTs so the public registration form can upload.
-- ─────────────────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('profile-pictures',    'profile-pictures',    true,
   5 * 1024 * 1024,
   array['image/jpeg','image/png','image/webp','image/heic']),
  ('payment-screenshots', 'payment-screenshots', false,
   5 * 1024 * 1024,
   array['image/jpeg','image/png','image/webp','image/heic','application/pdf'])
on conflict (id) do update
  set public             = excluded.public,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Storage policies live on the storage.objects table.

drop policy if exists "profile_pictures_anon_insert" on storage.objects;
create policy "profile_pictures_anon_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'profile-pictures');

drop policy if exists "profile_pictures_public_read" on storage.objects;
create policy "profile_pictures_public_read"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'profile-pictures');

drop policy if exists "payment_screenshots_anon_insert" on storage.objects;
create policy "payment_screenshots_anon_insert"
  on storage.objects
  for insert
  to anon, authenticated
  with check (bucket_id = 'payment-screenshots');

drop policy if exists "payment_screenshots_admin_read" on storage.objects;
create policy "payment_screenshots_admin_read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'payment-screenshots');

-- ─────────────────────────────────────────────────────────────────────────────
-- Optional stricter model: gate admin actions on membership in an `admins`
-- table instead of "any authenticated user". Uncomment if you want this.
--
-- create table if not exists public.admins (
--   user_id uuid primary key references auth.users(id) on delete cascade,
--   created_at timestamptz not null default now()
-- );
--
-- create or replace function public.is_admin() returns boolean
-- language sql stable security definer set search_path = public as $$
--   select exists (select 1 from public.admins where user_id = auth.uid());
-- $$;
--
-- Then replace `to authenticated using (true)` policies above with:
--   to authenticated using (public.is_admin())
