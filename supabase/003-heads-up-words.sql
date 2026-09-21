-- GameHub · Heads Up words in the database
--
-- Same move Mister White's Base made: the words leave the public code and live
-- here, where they can be revised without shipping a new version of the app.
-- The app only reads them, keeps a copy on the phone, and notices by itself
-- when they change.
--
-- Heads Up keeps its categories, where Mister White collapsed his into one
-- hidden Base. There the theme was a clue — it told the table what the word was
-- about, which hands Mister White most of the answer. Here the category IS the
-- game: you pick "Animali" and everyone knows it. So this is two tables, not
-- one: the categories, and the words inside them.
--
-- Paste into the Supabase SQL editor. Safe to run again: it doesn't duplicate
-- anything and doesn't delete data. It contains no words — those are loaded
-- separately, so the public repository still doesn't carry them.

-- The categories. One row each, with every language in it, so a category is
-- named in all of them or not at all.
--   id:   matches the id the app used to ship ('animali', 'cibo', …), so a
--         phone that had some switched on keeps exactly its choice.
--   icon: a name drawn in the app's line style (see ui.js).
--   sort: a stable order for building them, ties falling back to the id. It is
--         not the order you see: the app sorts packs by name, in the language
--         on screen, so the arc reads alphabetically in Italian and in English.
create table if not exists public.hu_packs (
  id       text primary key check (length(trim(id)) > 0),
  icon     text not null default 'words',
  name_it  text not null check (length(trim(name_it)) > 0),
  name_en  text not null check (length(trim(name_en)) > 0),
  sort     int  not null default 0
);

-- The words: one row per word, with every language in it. Every column is
-- required, so a word exists in all languages or not at all, and a category has
-- the same count in every language by construction — the same guarantee mw_base
-- makes for its pairs.
-- Adding a language means one more column here, one in hu_packs, and one entry
-- in LANGS in the app (src/shared/i18n.js).
create table if not exists public.hu_words (
  id          bigint generated always as identity primary key,
  pack        text not null references public.hu_packs (id) on update cascade on delete cascade,
  word_it     text not null check (length(trim(word_it)) > 0),
  word_en     text not null check (length(trim(word_en)) > 0),
  created_at  timestamptz not null default now(),
  unique (pack, word_it),
  unique (pack, word_en)
);

create index if not exists hu_words_pack_idx on public.hu_words (pack);

insert into public.pack_revisions (pack) values ('hu-words')
on conflict (pack) do nothing;

-- One counter-bumping function for every pack, instead of one per table: the
-- trigger says which counter it raises. Once per statement, not per row, so
-- loading a category in one insert is a single bump.
create or replace function public.bump_pack_revision()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.pack_revisions
     set revision = revision + 1, updated_at = now()
   where pack = tg_argv[0];
  return null;
end
$$;

revoke execute on function public.bump_pack_revision() from public, anon, authenticated;

-- Renaming a category counts as a change too: the app shows that name.
drop trigger if exists hu_packs_revision on public.hu_packs;
create trigger hu_packs_revision
after insert or update or delete or truncate on public.hu_packs
for each statement execute function public.bump_pack_revision('hu-words');

drop trigger if exists hu_words_revision on public.hu_words;
create trigger hu_words_revision
after insert or update or delete or truncate on public.hu_words
for each statement execute function public.bump_pack_revision('hu-words');

-- Mister White's counter moves to the same function, so there's one of them and
-- not one per pack. The triggers go first: they're what holds the old function.
drop trigger if exists mw_base_revision on public.mw_base;
create trigger mw_base_revision
after insert or update or delete or truncate on public.mw_base
for each statement execute function public.bump_pack_revision('mw-base');

-- mw_base_pairs is the retired table 002 copied the pairs out of. It's still
-- there on a database that hasn't dropped it yet, and its trigger holds the old
-- function too, so it moves across as well — same counter, same behaviour. A
-- database that never had the table, or has already dropped it, skips this.
do $$
begin
  if to_regclass('public.mw_base_pairs') is not null then
    execute 'drop trigger if exists mw_base_pairs_revision on public.mw_base_pairs';
    execute 'create trigger mw_base_pairs_revision
             after insert or update or delete or truncate on public.mw_base_pairs
             for each statement execute function public.bump_pack_revision(''mw-base'')';
  end if;
end
$$;

drop function if exists public.bump_mw_base_revision();

-- Access. Same as everything else here: the public key shipped in the app can
-- only read. Writing is only possible from the dashboard, which bypasses the
-- rules.
alter table public.hu_packs enable row level security;
alter table public.hu_words enable row level security;

drop policy if exists "lettura libera" on public.hu_packs;
create policy "lettura libera" on public.hu_packs
  for select to anon, authenticated using (true);

drop policy if exists "lettura libera" on public.hu_words;
create policy "lettura libera" on public.hu_words
  for select to anon, authenticated using (true);

grant select on public.hu_packs, public.hu_words to anon, authenticated;
revoke insert, update, delete, truncate on public.hu_packs, public.hu_words from anon, authenticated;
