-- Migration: auction system (single-auctioneer model).
--
-- Data model:
--   teams           — the franchises bidding for players
--   auction_state   — singleton row holding "who's on the block right now"
--   players additions — team_id / sold_price / sold_at recording the sale
--
-- Sale lifecycle:
--   1. Admin picks next player → auction_state.current_player_id = X,
--      current_bid = base_price, current_bidder_team_id = null
--   2. Each "bid for team T" → current_bid += increment, current_bidder = T
--   3. SOLD → write players row (team_id, sold_price, sold_at),
--      clear auction_state.current_player_id
--   4. UNSOLD → write players.sold_at = now() with team_id/price null,
--      clear auction_state.current_player_id
--
-- Run once in Supabase SQL editor. Safe to re-run.

-- ─────────────────────────────────────────────────────────────────────────────
-- teams
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.teams (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  short_name    text,
  owner_name    text,
  color         text,
  logo_url      text,
  budget_total  integer not null default 10000 check (budget_total > 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

create index if not exists teams_name_idx on public.teams (name);

-- ─────────────────────────────────────────────────────────────────────────────
-- players additions
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.players
  add column if not exists team_id    uuid references public.teams(id) on delete set null,
  add column if not exists sold_price integer check (sold_price is null or sold_price >= 0),
  add column if not exists sold_at    timestamptz;

create index if not exists players_team_id_idx on public.players (team_id);
create index if not exists players_sold_at_idx on public.players (sold_at) where sold_at is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- auction_state — singleton (id is text, always 'current')
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.auction_state (
  id                       text primary key default 'current' check (id = 'current'),
  current_player_id        uuid references public.players(id) on delete set null,
  current_bid              integer not null default 0,
  current_bidder_team_id   uuid references public.teams(id)   on delete set null,
  base_price               integer not null default 100 check (base_price > 0),
  bid_increment            integer not null default 100 check (bid_increment > 0),
  updated_at               timestamptz not null default now()
);

-- Seed the singleton row if missing.
insert into public.auction_state (id) values ('current')
on conflict (id) do nothing;

drop trigger if exists auction_state_set_updated_at on public.auction_state;
create trigger auction_state_set_updated_at
  before update on public.auction_state
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row-Level Security
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.teams         enable row level security;
alter table public.auction_state enable row level security;

-- teams: public read, authenticated write
drop policy if exists "teams_public_read"           on public.teams;
create policy "teams_public_read"
  on public.teams for select to anon, authenticated using (true);

drop policy if exists "teams_authenticated_write"   on public.teams;
create policy "teams_authenticated_write"
  on public.teams for all to authenticated
  using (true) with check (true);

-- auction_state: public read, authenticated update only (no insert/delete)
drop policy if exists "auction_state_public_read"      on public.auction_state;
create policy "auction_state_public_read"
  on public.auction_state for select to anon, authenticated using (true);

drop policy if exists "auction_state_authenticated_update" on public.auction_state;
create policy "auction_state_authenticated_update"
  on public.auction_state for update to authenticated
  using (true) with check (true);

-- Also: allow anon to READ players' sale info on the public auction board.
-- The existing players policies block anon SELECT entirely; relax for the
-- safe subset by adding a column-aware view OR just allow anon to read
-- selected columns via a separate policy. Simplest: add a SELECT policy
-- for anon that allows reading all columns (registration data is going
-- public via the auction board anyway). If you prefer to hide phone/utr
-- from the public board, swap the policy below for a column-filtered view.
drop policy if exists "players_public_read" on public.players;
create policy "players_public_read"
  on public.players for select to anon using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Realtime publication — public auction board subscribes here
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  -- supabase_realtime publication is created by the Supabase platform.
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.auction_state;
    alter publication supabase_realtime add table public.players;
  end if;
exception when duplicate_object then
  null;  -- already added
end $$;
