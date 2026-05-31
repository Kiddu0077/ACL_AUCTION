-- Migration: enforce one-UTR-per-registration so the same payment receipt
-- cannot be claimed by multiple players.
--
-- Two pieces:
--   1. Partial unique index — the source of truth, catches duplicates at the
--      DB level even under concurrent submits.
--   2. utr_exists() RPC — anon-callable, lets the registration form give
--      instant feedback BEFORE the user uploads files, so we don't pile up
--      orphaned storage objects on rejected submits.
--
-- Run once in Supabase SQL editor. Safe to re-run.

-- 1. Unique constraint
create unique index if not exists players_utr_number_unique
  on public.players (utr_number)
  where utr_number is not null;

-- 2. Pre-check RPC (security definer so anon can call without SELECT on the table)
create or replace function public.utr_exists(p_utr text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from public.players where utr_number = p_utr
  );
$$;

revoke all on function public.utr_exists(text) from public;
grant execute on function public.utr_exists(text) to anon, authenticated;
