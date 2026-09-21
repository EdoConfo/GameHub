-- GameHub · Quiplash prompts in the database
--
-- Same move Mister White's Base and Heads Up's categories made: the prompts
-- leave the public code and live here, where they can be revised without
-- shipping a new version of the app. The app only reads them, keeps a copy on
-- the phone, and notices by itself when they change.
--
-- One pack, not several, and hidden in the app: a prompt read beforehand is a
-- prompt somebody has already written the answer to. That's also why there is
-- no category column here — there is nothing to choose between.
--
-- Run schema.sql and 003-heads-up-words.sql first: this file uses the shared
-- counter table and the one bump function they leave behind.
--
-- Paste into the Supabase SQL editor. Safe to run again: it doesn't duplicate
-- anything and doesn't delete data. It contains no prompts — those are loaded
-- separately, so the public repository still doesn't carry them.

-- Nothing here is needed for the rooms Quiplash plays in. Those go over
-- Supabase Realtime in broadcast mode: the phones talk to each other through
-- it and nothing is ever written down, so there is no table for a match, no
-- rows to clean up, and the key shipped in the app still only reads. The one
-- thing the project must allow is a public channel, which is the default.

-- The prompts: one row per prompt, with every language in it. Every column is
-- required, so a prompt exists in all languages or not at all, and every
-- language plays the same number of them by construction.
-- Adding a language means one more column here, and one entry in LANGS in the
-- app (src/shared/i18n.js).
create table if not exists public.ql_prompts (
  id          bigint generated always as identity primary key,
  text_it     text not null check (length(trim(text_it)) > 0),
  text_en     text not null check (length(trim(text_en)) > 0),
  created_at  timestamptz not null default now(),
  unique (text_it),
  unique (text_en)
);

insert into public.pack_revisions (pack) values ('ql-prompts')
on conflict (pack) do nothing;

-- Any change to the prompts raises the counter, once per statement: loading a
-- hundred of them in one insert is a single bump.
drop trigger if exists ql_prompts_revision on public.ql_prompts;
create trigger ql_prompts_revision
after insert or update or delete or truncate on public.ql_prompts
for each statement execute function public.bump_pack_revision('ql-prompts');

-- Access. Same as everything else here: the public key shipped in the app can
-- only read. Writing is only possible from the dashboard, which bypasses the
-- rules.
alter table public.ql_prompts enable row level security;

drop policy if exists "lettura libera" on public.ql_prompts;
create policy "lettura libera" on public.ql_prompts
  for select to anon, authenticated using (true);

grant select on public.ql_prompts to anon, authenticated;
revoke insert, update, delete, truncate on public.ql_prompts from anon, authenticated;
