-- GameHub · il Base con le lingue affiancate
--
-- Prima: una riga per coppia e per lingua (mw_base_pairs), con liste
-- indipendenti — una lingua poteva avere più coppie di un'altra.
-- Ora: una riga per coppia, con tutte le sue traduzioni (mw_base). Ogni colonna
-- è obbligatoria, quindi una coppia esiste in tutte le lingue o non esiste: il
-- numero di coppie è lo stesso in ogni lingua per costruzione.
--
-- Da incollare nell'editor SQL, una volta. Non contiene parole: le copia dalla
-- tabella esistente, abbinando le due lingue per posizione (la prima coppia
-- italiana con la prima inglese, e così via). Una coppia che esiste in una sola
-- lingua resta fuori. Si può rieseguire: se mw_base ha già righe, non copia.
--
-- La tabella vecchia resta com'è finché l'app non è passata a quella nuova;
-- poi si toglie con: drop table public.mw_base_pairs;

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

-- Il contatore sale anche per questa tabella (la funzione è quella di
-- schema.sql). Creato prima della copia, così la copia stessa lo fa salire.
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

-- Stesse regole della tabella vecchia: la chiave dell'app legge e basta.
alter table public.mw_base enable row level security;

drop policy if exists "lettura libera" on public.mw_base;
create policy "lettura libera" on public.mw_base
  for select to anon, authenticated using (true);

grant select on public.mw_base to anon, authenticated;
revoke insert, update, delete, truncate on public.mw_base from anon, authenticated;

-- Quante ne sono passate, e quali sono rimaste fuori perché senza traduzione.
select count(*) as coppie_nella_tabella_nuova from public.mw_base;

select p.lang, p.civilian, p.undercover as rimaste_fuori
from public.mw_base_pairs p
where not exists (
  select 1 from public.mw_base b
  where (p.lang = 'it' and b.civilian_it = p.civilian and b.undercover_it = p.undercover)
     or (p.lang = 'en' and b.civilian_en = p.civilian and b.undercover_en = p.undercover)
);
