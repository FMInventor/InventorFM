-- ═══════════════════════════════════════════════════════════════
--  Smart Pantry Pro — schema database
--  Incolla tutto in Supabase → SQL Editor → New query → Run.
--  Si può rieseguire senza problemi (non cancella i dati).
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

-- ── Sicurezza: ogni utente vede e modifica SOLO le proprie righe ──
do $$
declare t text;
begin
  foreach t in array array['products', 'lots', 'usage_log', 'shopping'] loop
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
