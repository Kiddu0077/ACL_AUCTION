-- Migration: split teams into two pools (A and B) for group-stage play.
--
-- `pool` is nullable until pools are drawn.
--
-- Run once in Supabase SQL editor. Safe to re-run.

alter table public.teams
  add column if not exists pool text
  check (pool is null or pool in ('A', 'B'));

create index if not exists teams_pool_idx on public.teams (pool);
