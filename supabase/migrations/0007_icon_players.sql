-- Migration: icon players — star players added directly to a team without
-- going through public registration (and therefore without a phone number).
--
-- Run once in Supabase SQL editor. Safe to re-run.

-- Flag for icon players (shows an ICON badge, lets them skip registration).
alter table public.players
  add column if not exists is_icon boolean not null default false;

-- Icon players may not have a phone, so allow NULL.
alter table public.players
  alter column phone drop not null;

-- Rebuild the normalized-phone unique index so it ignores NULL / empty phones
-- (otherwise multiple phoneless icon players would collide on '').
drop index if exists players_phone_normalized_unique;
create unique index players_phone_normalized_unique
  on public.players (public.phone_normalized(phone))
  where phone is not null and public.phone_normalized(phone) <> '';
