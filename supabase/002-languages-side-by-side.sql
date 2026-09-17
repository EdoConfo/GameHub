-- GameHub · the Base with languages side by side
--
-- Only for a database created before this change. A new database gets mw_base
-- straight from schema.sql and never had the old table: skip this file.
--
-- Before: one row per pair and per language (mw_base_pairs), with independent
-- lists — one language could have more pairs than another.
-- Now: one row per pair, with all its translations (mw_base). Every column is
-- required, so a pair exists in all languages or not at all: the number of
-- pairs is the same in every language by construction.
--
-- Paste into the SQL editor, once. It contains no words: it copies them from
-- the existing table, matching the two languages by position (the first Italian
-- pair with the first English one, and so on). A pair that exists in only one
-- language is left out. Safe to run again: if mw_base already has rows, it
-- doesn't copy.
--
-- The old table stays as it is until the app has moved to the new one; then
-- remove it with: drop table public.mw_base_pairs;

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

-- The counter goes up for this table too (the function is the one in
-- schema.sql). Created before the copy, so the copy itself bumps it.
drop trigger if exists mw_base_revision on public.mw_base;
create trigger mw_base_revision
after insert or update or delete or truncate on public.mw_base
for each statement execute function public.bump_mw_base_revision();

insert into public.mw_base (civilian_it, undercover_it, civilian_en, undercover_en)
select i.civilian, i.undercover, e.civilian, e.undercover
from (select civilian, undercover, row_number() over (order by id) as n
        from public.mw_base_pairs where lang = 'it') i
join (select civilian, undercover, row_number() over (order by id) as n
        from public.mw_base_pairs where lang = 'en') e using (n)
where not exists (select 1 from public.mw_base)
order by n;

-- Same rules as the old table: the app's key can only read.
alter table public.mw_base enable row level security;

drop policy if exists "lettura libera" on public.mw_base;
create policy "lettura libera" on public.mw_base
  for select to anon, authenticated using (true);

grant select on public.mw_base to anon, authenticated;
revoke insert, update, delete, truncate on public.mw_base from anon, authenticated;

-- How many made it across, and which were left out for lack of a translation.
select count(*) as pairs_in_new_table from public.mw_base;

select p.lang, p.civilian, p.undercover as left_out
from public.mw_base_pairs p
where not exists (
  select 1 from public.mw_base b
  where (p.lang = 'it' and b.civilian_it = p.civilian and b.undercover_it = p.undercover)
     or (p.lang = 'en' and b.civilian_en = p.civilian and b.undercover_en = p.undercover)
);
