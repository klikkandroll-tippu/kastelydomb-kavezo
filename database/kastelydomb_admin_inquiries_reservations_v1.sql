-- Applied to Supabase project snxlismmgzwpxerenwsv on 2026-11-08.
-- Additive schema only. All access is server-side service_role; never expose the key in browser code.
create table if not exists public.kastelydomb_contacts (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 customer_name text not null,
 customer_email text not null,
 customer_phone text not null,
 message text not null,
 status text not null default 'new',
 internal_notes text not null default '',
 is_test boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.kastelydomb_reservations (
 id uuid primary key default gen_random_uuid(),
 request_id uuid not null unique,
 customer_name text not null,
 customer_email text not null,
 customer_phone text not null,
 reservation_date date not null,
 reservation_time time not null,
 guest_count integer not null check (guest_count between 1 and 20),
 guest_notes text not null default '',
 status text not null default 'pending',
 confirmed_at timestamptz,
 confirmed_by text,
 internal_notes text not null default '',
 is_test boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists kd_contacts_created_at_idx on public.kastelydomb_contacts(created_at desc);
create index if not exists kd_reservations_date_time_idx on public.kastelydomb_reservations(reservation_date,reservation_time);
alter table public.kastelydomb_contacts enable row level security;
alter table public.kastelydomb_reservations enable row level security;
revoke all on public.kastelydomb_contacts from anon,authenticated;
revoke all on public.kastelydomb_reservations from anon,authenticated;
