-- Migration: prevent the same player from registering twice via phone.
--
-- Normalization rule: strip every non-digit, then take the LAST 10 digits.
-- This way "+91 99999 12345", "+919999912345", "99-99-91-23-45", and
-- "9999912345" all collapse to the same key "9999912345".
--
-- Two pieces:
--   1. phone_normalized() — pure SQL helper for the canonical form.
--   2. Partial unique index using that helper as an expression.
--   3. phone_exists() RPC — anon-callable, lets the registration form
--      give instant feedback BEFORE upload, mirroring utr_exists().
--
-- ⚠️  Pre-flight check: if there are already duplicate phones in the table,
-- the unique index creation will fail. Clean them up first with:
--     select right(regexp_replace(phone, '[^0-9]', '', 'g'), 10) as norm,
--            count(*), array_agg(id)
--     from public.players group by 1 having count(*) > 1;
--
-- Run once in Supabase SQL editor. Safe to re-run.

-- 1. Normalization helper. IMMUTABLE so it's safe to use in an index.
create or replace function public.phone_normalized(p text)
returns text
language sql
immutable
set search_path = public
as $$
  select right(regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g'), 10);
$$;

-- 2. Unique index on the normalized form
create unique index if not exists players_phone_normalized_unique
  on public.players (public.phone_normalized(phone));

-- 3. Pre-check RPC, callable by anonymous registration form
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
