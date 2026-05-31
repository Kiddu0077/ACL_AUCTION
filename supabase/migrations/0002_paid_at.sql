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

alter table public.players
  add column if not exists paid_at timestamptz;

create index if not exists players_paid_at_idx
  on public.players (paid_at)
  where paid_at is not null;
