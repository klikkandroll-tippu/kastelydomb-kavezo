-- Kastelydomb operational extensions. Private customer data: no anon/authenticated table grants.
create table if not exists public.kastelydomb_drivers (
 id uuid primary key default gen_random_uuid(), name text not null, phone text not null,
 area text not null default '', active boolean not null default true, created_at timestamptz not null default now()
);
create table if not exists public.kastelydomb_assignments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.kastelydomb_orders(id) on delete restrict,
 driver_id uuid not null references public.kastelydomb_drivers(id) on delete restrict,
 assigned_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(order_id)
);
create table if not exists public.kastelydomb_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.kastelydomb_orders(id) on delete restrict,
 driver_id uuid references public.kastelydomb_drivers(id) on delete restrict,
 amount_huf integer not null check(amount_huf>0),
 method text not null check(method in ('cash','card','transfer')),
 created_at timestamptz not null default now(),
 note text
);
create table if not exists public.kastelydomb_settlements (
 id uuid primary key default gen_random_uuid(),
 driver_id uuid not null references public.kastelydomb_drivers(id) on delete restrict,
 period_start date not null, period_end date not null,
 cash_huf integer not null default 0, card_huf integer not null default 0,
 unpaid_huf integer not null default 0, order_count integer not null default 0,
 created_at timestamptz not null default now(),
 unique(driver_id,period_start,period_end)
);
create table if not exists public.kastelydomb_menu_weeks (
 id uuid primary key default gen_random_uuid(),
 week_start date not null unique,
 days jsonb not null check(jsonb_typeof(days)='array'),
 published boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists kd_assignments_driver on public.kastelydomb_assignments(driver_id);
create index if not exists kd_payments_order on public.kastelydomb_payments(order_id);
create index if not exists kd_payments_driver on public.kastelydomb_payments(driver_id);
do $$ declare t text; begin
 foreach t in array array['kastelydomb_drivers','kastelydomb_assignments','kastelydomb_payments','kastelydomb_settlements','kastelydomb_menu_weeks']
 loop execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select, insert, update on public.%I to service_role',t);
 end loop; end $$;
