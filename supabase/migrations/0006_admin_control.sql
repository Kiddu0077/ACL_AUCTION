-- Migration: full admin control — team locking, squad size limits, and an
-- auction lifecycle status.
--
-- Run once in Supabase SQL editor. Safe to re-run.

-- Teams: can be locked out of bidding, and have a target squad size.
alter table public.teams
  add column if not exists is_locked  boolean not null default false,
  add column if not exists squad_size integer not null default 11
    check (squad_size > 0);

-- Auction lifecycle: idle → live → paused → ended (drives the public board).
alter table public.auction_state
  add column if not exists status text not null default 'idle'
    check (status in ('idle', 'live', 'paused', 'ended'));
