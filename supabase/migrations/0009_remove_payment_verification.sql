-- Retire payment tracking and registration approval. All registered players
-- remain in the auction pool without a separate approval step.
--
-- Apply after 0008 on existing databases. Safe to re-run, and also safe after
-- the current base schema plus historical migrations on a fresh database.
-- This removes the old payment/approval metadata, but preserves player rows,
-- profile pictures, teams, auction history, Auth, and stored receipt files.
-- The private receipt bucket is retained; its application access policies are
-- removed. No storage objects or buckets are deleted.

begin;

-- Remove the status-dependent policy before dropping its column.
drop policy if exists "players_insert_anon" on public.players;

drop function if exists public.utr_exists(text);

drop index if exists public.players_status_idx;
drop index if exists public.players_paid_at_idx;
drop index if exists public.players_utr_number_unique;

alter table public.players
  drop column if exists status,
  drop column if exists paid_at,
  drop column if exists utr_number,
  drop column if exists payment_screenshot_url;

-- Deliberately no CASCADE: unexpected external dependencies should cause the
-- transaction to fail safely rather than silently deleting unrelated objects.
drop type if exists public.player_status;

-- Registration can create ordinary players only. Guard the auction fields
-- that exist so older installations without every auction addition also work.
do $$
declare
  registration_checks text;
begin
  select string_agg(check_sql, ' and ' order by ordinal)
    into registration_checks
  from (values
    ('team_id', 'team_id is null', 1),
    ('sold_price', 'sold_price is null', 2),
    ('sold_at', 'sold_at is null', 3),
    ('is_icon', 'is_icon = false', 4)
  ) as checks(column_name, check_sql, ordinal)
  where exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'players'
      and c.column_name = checks.column_name
  );

  execute format(
    'create policy players_insert_anon on public.players for insert to anon, authenticated with check (%s)',
    coalesce(registration_checks, 'true')
  );
end $$;

drop policy if exists "payment_screenshots_anon_insert" on storage.objects;
drop policy if exists "payment_screenshots_admin_read" on storage.objects;

commit;
