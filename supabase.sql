-- ═══════════════════════════════════════════════════════════════
--  Smart Pantry Pro — schema database (v5)
--  Incolla tutto in Supabase → SQL Editor → New query → Run.
--  Si può rieseguire quante volte vuoi: NON cancella i dati,
--  aggiunge solo ciò che manca (aggiorna anche le versioni precedenti).
-- ═══════════════════════════════════════════════════════════════

-- Prodotti (un prodotto può avere più lotti con scadenze diverse)
create table if not exists public.products (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  category    text not null default 'Altro',
  unit        text not null default 'pz',
  created_at  timestamptz not null default now()
);
create unique index if not exists products_user_name_idx
  on public.products (user_id, lower(name));

-- Lotti: quantità + data di scadenza (facoltativa, es. per gli strumenti)
create table if not exists public.lots (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_id  uuid not null references public.products (id) on delete cascade,
  qty         numeric not null check (qty >= 0),
  expiry      date,
  created_at  timestamptz not null default now()
);
create index if not exists lots_product_idx on public.lots (product_id);

-- Storico consumi (alimenta il grafico radar settimanale)
create table if not exists public.usage_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  product_name  text not null,
  category      text not null,
  qty           numeric not null,
  unit          text not null,
  used_at       timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

-- Lista della spesa
create table if not exists public.shopping (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null,
  note        text,
  done        boolean not null default false,
  created_at  timestamptz not null default now()
);
-- v2: quantità, unità e categoria nella lista della spesa
alter table public.shopping add column if not exists qty      numeric;
alter table public.shopping add column if not exists unit     text;
alter table public.shopping add column if not exists category text;

-- v3: più categorie per prodotto (la prima è la principale) e data di congelamento
alter table public.products  add column if not exists categories text[];
alter table public.lots      add column if not exists frozen_at  date;
alter table public.usage_log add column if not exists categories text[];
update public.products set categories = array[category] where categories is null;

-- v4: selezione nella lista della spesa e lista Mother generata
alter table public.shopping add column if not exists selected  boolean not null default false;
alter table public.shopping add column if not exists in_mother boolean not null default false;

-- v5: scorta minima, menù salvati, notifiche push
alter table public.products add column if not exists min_qty numeric;

create table if not exists public.menus (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null default 'Menù',
  body        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Notifiche già inviate (le usa solo il server, per non ripeterle)
create table if not exists public.push_sent (
  lot_id   uuid not null references public.lots (id) on delete cascade,
  stage    text not null,
  sent_at  timestamptz not null default now(),
  primary key (lot_id, stage)
);
alter table public.push_sent enable row level security;
revoke all on public.push_sent from anon, authenticated;

-- v2: link segreto per la sezione Mother (lista visibile senza login)
create table if not exists public.share_links (
  user_id     uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token       uuid not null unique default gen_random_uuid(),
  created_at  timestamptz not null default now()
);

-- ── Sicurezza: ogni utente vede e modifica SOLO le proprie righe ──
do $$
declare t text;
begin
  foreach t in array array['products', 'lots', 'usage_log', 'shopping', 'share_links', 'menus', 'push_subscriptions'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "solo i miei dati" on public.%I', t);
    execute format(
      'create policy "solo i miei dati" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ── Funzioni per la pagina Mother ──
-- Chi ha il link (token) può SOLO leggere la lista della spesa e spuntare "preso".
-- Non vede la dispensa e non può modificare nient'altro.
create or replace function public.mother_list(p_token uuid)
returns table (id uuid, name text, qty numeric, unit text, category text,
               note text, done boolean, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.name, s.qty, s.unit, s.category, s.note, s.done, s.created_at
  from public.shopping s
  join public.share_links l on l.user_id = s.user_id
  where l.token = p_token and s.in_mother
  order by s.created_at;
$$;

create or replace function public.mother_toggle(p_token uuid, p_id uuid, p_done boolean)
returns void
language sql security definer set search_path = public as $$
  update public.shopping s set done = p_done
  from public.share_links l
  where l.token = p_token and l.user_id = s.user_id and s.id = p_id and s.in_mother;
$$;

revoke all on function public.mother_list(uuid) from public;
revoke all on function public.mother_toggle(uuid, uuid, boolean) from public;
grant execute on function public.mother_list(uuid) to anon, authenticated;
grant execute on function public.mother_toggle(uuid, uuid, boolean) to anon, authenticated;

-- ── Aggiornamenti in tempo reale (Realtime) ──
do $$
declare t text;
begin
  foreach t in array array['products', 'lots', 'usage_log', 'shopping', 'menus'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when others then null; -- già presente o Realtime non disponibile
    end;
  end loop;
end $$;
