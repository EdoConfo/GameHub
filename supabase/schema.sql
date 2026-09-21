-- GameHub · database
--
-- Mister White's Base pack lives here instead of in the public code.
-- The app only reads it: it downloads it, keeps it on the phone to play without
-- a network, and notices by itself when it changes. Only someone with access to
-- the Supabase dashboard can edit it.
--
-- Paste into the Supabase SQL editor. Safe to run again: it doesn't duplicate
-- anything and doesn't delete data.
--
-- A database created before the languages were side by side has the old
-- mw_base_pairs table instead: 002-languages-side-by-side.sql moves it over.
--
-- Heads Up's categories live here too, in their own two tables: run this file
-- first, then 003-heads-up-words.sql. That one also moves the counter below
-- onto a single function shared by every pack, so after it there is no
-- bump_mw_base_revision() any more — which is why this file creates it: run
-- alone, on a fresh database, it still has to work.

-- The pairs: one row per pair, with every language in it. Every column is
-- required, so a pair exists in all languages or not at all: every language
-- has the same number of pairs by construction.
-- Adding a language means two more columns here, and in LANGS in the app
-- (src/shared/i18n.js).
create table if not exists public.mw_base (
  id             bigint generated always as identity primary key,
  civilian_it    text not null check (length(trim(civilian_it)) > 0),
  undercover_it  text not null check (length(trim(undercover_it)) > 0),
  civilian_en    text not null check (length(trim(civilian_en)) > 0),
  undercover_en  text not null check (length(trim(undercover_en)) > 0),
  created_at     timestamptz not null default now(),
  unique (civilian_it, undercover_it),
  unique (civilian_en, undercover_en)
);

-- One counter per pack. The app compares it with the one it saved: if it
-- changed, there's something to download again. Reading a number costs
-- nothing; downloading hundreds of pairs every minute doesn't.
create table if not exists public.pack_revisions (
  pack        text primary key,
  revision    bigint not null default 0,
  updated_at  timestamptz not null default now()
);

insert into public.pack_revisions (pack) values ('mw-base')
on conflict (pack) do nothing;

-- Any change to the pairs — adding, fixing, deleting, even emptying the table —
-- raises the counter. Once per statement, not per row: removing a hundred pairs
-- at once is a single bump.
create or replace function public.bump_mw_base_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.pack_revisions
     set revision = revision + 1, updated_at = now()
   where pack = 'mw-base';
  return null;
end
$$;

revoke execute on function public.bump_mw_base_revision() from public, anon, authenticated;

drop trigger if exists mw_base_revision on public.mw_base;
create trigger mw_base_revision
after insert or update or delete or truncate on public.mw_base
for each statement execute function public.bump_mw_base_revision();

-- Access. The rules apply to the public key shipped in the app: it can only
-- read. Writing is only possible from the dashboard, which bypasses the rules.
-- (Policy names are kept as they are in the live database, so reruns replace
-- them instead of adding a second one.)
alter table public.mw_base        enable row level security;
alter table public.pack_revisions enable row level security;

drop policy if exists "lettura libera" on public.mw_base;
create policy "lettura libera" on public.mw_base
  for select to anon, authenticated using (true);

drop policy if exists "lettura libera" on public.pack_revisions;
create policy "lettura libera" on public.pack_revisions
  for select to anon, authenticated using (true);

-- The project doesn't expose tables on its own: access is granted explicitly,
-- and only for reading.
grant usage on schema public to anon, authenticated;
grant select on public.mw_base, public.pack_revisions to anon, authenticated;
revoke insert, update, delete, truncate on public.mw_base, public.pack_revisions from anon, authenticated;
