-- ============================================================
-- SCHEMA: Gestionale Azienda (Sito Staff)
-- Esegui questo script nel SQL Editor di Supabase.
-- ============================================================

-- Estensione per gen_random_uuid()
create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PROFILES: collega auth.users al ruolo applicativo
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('staff', 'client')),
  full_name text,
  email text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Un utente vede il proprio profilo"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Lo staff vede tutti i profili"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );

-- ------------------------------------------------------------
-- CLIENTS: anagrafica B2B con sconto personalizzato
-- ------------------------------------------------------------
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  discount_percentage numeric(5,2) not null default 0
    check (discount_percentage >= 0 and discount_percentage <= 100),
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;

create policy "Lo staff gestisce i clienti"
  on public.clients for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );

-- ------------------------------------------------------------
-- PRODUCTS: catalogo con prezzo e unità di misura
-- ------------------------------------------------------------
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price numeric(10,2) not null check (price >= 0),
  unit text not null check (unit in ('ct', 'cf', 'rt', 'pz', 'bl')),
  image_url text,
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;

create policy "Lo staff gestisce i prodotti"
  on public.products for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );

-- ------------------------------------------------------------
-- ORDERS: ordini ricevuti dai clienti
-- ------------------------------------------------------------
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  client_name text not null,
  order_date date not null default current_date,
  items jsonb not null default '[]'::jsonb,
  total numeric(10,2) not null default 0,
  reported boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

create policy "Lo staff gestisce gli ordini"
  on public.orders for all
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );

-- ------------------------------------------------------------
-- STORAGE: bucket per le foto prodotto
-- ------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

create policy "Lettura pubblica immagini prodotto"
  on storage.objects for select
  using (bucket_id = 'product-images');

create policy "Lo staff carica immagini prodotto"
  on storage.objects for insert
  with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );

create policy "Lo staff aggiorna immagini prodotto"
  on storage.objects for update
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );

create policy "Lo staff elimina immagini prodotto"
  on storage.objects for delete
  using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'staff'
    )
  );

-- ------------------------------------------------------------
-- Per creare il primo utente staff:
-- 1) Crea l'utente da Authentication > Users nella dashboard Supabase
-- 2) Poi esegui (sostituendo l'UUID con quello dell'utente creato):
--
-- insert into public.profiles (id, role, full_name, email)
-- values ('UUID-DELL-UTENTE', 'staff', 'Nome Cognome', 'staff@azienda.it');
-- ------------------------------------------------------------
