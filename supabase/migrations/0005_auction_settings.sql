-- Migration: extend auction_state with a default team budget so new teams
-- inherit it. Existing teams keep their own budget.
--
-- Run once in Supabase SQL editor. Safe to re-run.

alter table public.auction_state
  add column if not exists default_team_budget integer not null default 10000
    check (default_team_budget > 0);
