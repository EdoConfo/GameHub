-- GameHub · database
--
-- Il pacchetto Base di Mister White vive qui invece che nel codice pubblico.
-- L'app lo legge soltanto: lo scarica, lo tiene sul telefono per giocare senza
-- rete, e si accorge da sola quando cambia. Lo modifica solo chi ha accesso al
-- pannello di Supabase.
--
-- Da incollare nell'editor SQL di Supabase. Si può rieseguire: non duplica
-- niente e non cancella dati.

-- Le coppie, una riga per coppia e per lingua.
create table if not exists public.mw_base_pairs (
  id          bigint generated always as identity primary key,
  lang        text not null check (lang in ('it', 'en')),
  civilian    text not null check (length(trim(civilian)) > 0),
  undercover  text not null check (length(trim(undercover)) > 0),
  created_at  timestamptz not null default now(),
  unique (lang, civilian, undercover)
);

-- Un contatore per pacchetto. L'app confronta il suo con quello salvato: se è
-- cambiato, c'è da riscaricare. Leggere un numero costa niente; riscaricare
-- centinaia di coppie ogni minuto no.
create table if not exists public.pack_revisions (
  pack        text primary key,
  revision    bigint not null default 0,
  updated_at  timestamptz not null default now()
);

insert into public.pack_revisions (pack) values ('mw-base')
on conflict (pack) do nothing;

-- Qualunque modifica alle coppie — aggiunta, correzione, cancellazione, anche
-- svuotare la tabella — fa salire il contatore. Una volta per operazione, non
-- per riga: togliere cento coppie insieme è un solo aggiornamento.
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

drop trigger if exists mw_base_pairs_revision on public.mw_base_pairs;
create trigger mw_base_pairs_revision
after insert or update or delete or truncate on public.mw_base_pairs
for each statement execute function public.bump_mw_base_revision();

-- Accesso. Le regole valgono per la chiave pubblica che sta nell'app: può solo
-- leggere. Scrivere si può soltanto dal pannello, che le regole le scavalca.
alter table public.mw_base_pairs  enable row level security;
alter table public.pack_revisions enable row level security;

drop policy if exists "lettura libera" on public.mw_base_pairs;
create policy "lettura libera" on public.mw_base_pairs
  for select to anon, authenticated using (true);

drop policy if exists "lettura libera" on public.pack_revisions;
create policy "lettura libera" on public.pack_revisions
  for select to anon, authenticated using (true);

-- Il progetto non espone le tabelle da solo: si concede esplicitamente, e
-- soltanto la lettura.
grant usage on schema public to anon, authenticated;
grant select on public.mw_base_pairs, public.pack_revisions to anon, authenticated;
revoke insert, update, delete, truncate on public.mw_base_pairs, public.pack_revisions from anon, authenticated;
