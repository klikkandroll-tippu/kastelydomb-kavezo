-- Kizárólag a Kastélydomb projekthez rendelt Supabase projektben futtatható.
-- A nyilvános Data API hozzáférést RLS tiltja; írás/olvasás kizárólag szerveroldali kulccsal.
create extension if not exists pgcrypto;
create table if not exists public.kastelydomb_orders (
 id uuid primary key default gen_random_uuid(),
 order_number text not null unique,
 customer_name text not null,
 customer_email text,
 customer_phone text,
 customer_type text not null default 'private' check (customer_type in ('private','company')),
 company_name text,
 fulfillment text not null check (fulfillment in ('pickup','delivery','dine_in')),
 delivery_address text,
 payment_method text not null check (payment_method in ('cash_on_pickup','card_on_pickup','online_card','company_transfer')),
 payment_status text not null default 'unpaid' check (payment_status in ('unpaid','pending','paid')),
 status text not null default 'new' check (status in ('new','confirmed','preparing','ready','completed','cancelled')),
 total_huf integer not null check (total_huf>=0),
 items jsonb not null default '[]'::jsonb check (jsonb_typeof(items)='array'),
 notes text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint company_transfer_requires_company check(payment_method<>'company_transfer' or customer_type='company')
);
create index if not exists kastelydomb_orders_created_idx on public.kastelydomb_orders(created_at desc);
alter table public.kastelydomb_orders enable row level security;
revoke all on public.kastelydomb_orders from anon, authenticated;
-- Az admin API csak a szerveroldali service_role kulccsal érheti el.

-- Service API key runs with service_role; explicit grants are needed when public auto-grants are disabled.
grant select, insert, update on public.kastelydomb_orders to service_role;
