-- Migration: add paid_at column to track when registration fee was collected.
--
-- Separating payment from `status`:
--   • status   = registration approval (Pending / Verified / Rejected)
--   • paid_at  = when fee was collected (null = unpaid; timestamp = paid then)
--
-- Why timestamp not boolean? Lets us see when payment came in (useful for
-- post-auction follow-up tracking), and we can derive a boolean trivially.
--
-- Run once in Supabase SQL editor. Safe to re-run.
-- Retired by 0009. Only legacy schemas with player approval status need this
-- column; do not recreate it on the current schema or after removal.

do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'players'
      and column_name = 'status'
  ) then
    return;
  end if;

  alter table public.players
    add column if not exists paid_at timestamptz;

  create index if not exists players_paid_at_idx
    on public.players (paid_at)
    where paid_at is not null;
end $$;
