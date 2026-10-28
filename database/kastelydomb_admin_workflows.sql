-- Additive, server-only admin workflows. Existing orders are preserved.
alter table public.kastelydomb_orders add column if not exists company_address text;
alter table public.kastelydomb_orders add column if not exists tax_number text;
alter table public.kastelydomb_payments add column if not exists request_id uuid unique;
create table if not exists public.kastelydomb_admin_sessions(token_hash text primary key, expires_at timestamptz not null);
create table if not exists public.kastelydomb_rate_limits(key text primary key, started_at timestamptz not null default now(), attempts integer not null default 0);
create table if not exists public.kastelydomb_audit(id uuid primary key default gen_random_uuid(), action text not null, entity_id uuid, created_at timestamptz not null default now(), details jsonb not null default '{}');
do $$declare t text;begin foreach t in array array['kastelydomb_admin_sessions','kastelydomb_rate_limits','kastelydomb_audit'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from public, anon, authenticated',t);
 execute format('grant select, insert, update, delete on public.%I to service_role',t);
end loop;end$$;
revoke execute on function public.rls_auto_enable() from public,anon,authenticated;

create or replace function public.kd_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer;begin
 if p_limit<1 or p_limit>200 or p_seconds<1 or p_seconds>86400 then raise exception 'Hibás korlát.';end if;
 delete from public.kastelydomb_admin_sessions where expires_at<now();
 delete from public.kastelydomb_rate_limits where started_at<now()-interval '1 day';
 insert into public.kastelydomb_rate_limits as r(key,started_at,attempts) values(p_key,now(),1)
 on conflict(key) do update set attempts=case when r.started_at<now()-make_interval(secs=>p_seconds) then 1 else r.attempts+1 end,
 started_at=case when r.started_at<now()-make_interval(secs=>p_seconds) then now() else r.started_at end returning attempts into n;
 return n<=p_limit;
end$$;
create or replace function public.kd_driver(p_id uuid,p_name text,p_phone text,p_area text,p_active boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.kastelydomb_drivers;begin
 perform pg_advisory_xact_lock(8271028);
 if p_name is null or length(trim(p_name))=0 or length(p_name)>120 or p_phone is null or length(p_phone)>40 then raise exception 'Hibás futár.';end if;
 if p_id is null then insert into public.kastelydomb_drivers(name,phone,area,active) values(p_name,p_phone,p_area,p_active) returning * into d;
 else update public.kastelydomb_drivers set name=p_name,phone=p_phone,area=p_area,active=p_active where id=p_id returning * into d; if not found then raise exception 'Nincs ilyen futár.';end if;end if;
 insert into public.kastelydomb_audit(action,entity_id) values('driver_saved',d.id);return to_jsonb(d);
end$$;
create or replace function public.kd_assign(p_order uuid,p_driver uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.kastelydomb_orders;a public.kastelydomb_assignments;begin
 perform pg_advisory_xact_lock(8271028);
 select * into o from public.kastelydomb_orders where id=p_order for update;
 if not found or o.fulfillment<>'delivery' or o.status in ('cancelled','completed') then raise exception 'Csak aktív kiszállítás rendelhető futárhoz.';end if;
 if not exists(select 1 from public.kastelydomb_drivers where id=p_driver and active) then raise exception 'Aktív futár szükséges.';end if;
 if exists(select 1 from public.kastelydomb_payments where order_id=p_order and driver_id is not null) then raise exception 'Befizetés után a futár nem módosítható.';end if;
 insert into public.kastelydomb_assignments(order_id,driver_id) values(p_order,p_driver) on conflict(order_id) do update set driver_id=excluded.driver_id,assigned_at=now() returning * into a;
 insert into public.kastelydomb_audit(action,entity_id,details) values('driver_assigned',p_order,jsonb_build_object('driver_id',p_driver));return to_jsonb(a);
end$$;
create or replace function public.kd_payment(p_order uuid,p_driver uuid,p_amount integer,p_method text,p_request uuid) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.kastelydomb_orders;p public.kastelydomb_payments;paid bigint;begin
 perform pg_advisory_xact_lock(8271028);
 select * into p from public.kastelydomb_payments where request_id=p_request;
 if found then
 if p.order_id<>p_order or p.driver_id is distinct from p_driver or p.amount_huf<>p_amount or p.method<>p_method then raise exception 'Eltérő tartalmú ismételt kérés.';end if;
 return to_jsonb(p);end if;
 if p_request is null or p_amount is null or p_amount<=0 or p_method is null or p_method not in ('cash','card','transfer') then raise exception 'Hibás befizetés.';end if;
 select * into o from public.kastelydomb_orders where id=p_order for update;
 if not found or o.status='cancelled' then raise exception 'A rendelés nem fizethető.';end if;
 if p_method='transfer' and o.customer_type<>'company' then raise exception 'Átutalás csak céges rendeléshez.';end if;
 if p_driver is not null and (p_method='transfer' or not exists(select 1 from public.kastelydomb_assignments where order_id=p_order and driver_id=p_driver)) then raise exception 'A futár nincs hozzárendelve.';end if;
 select coalesce(sum(amount_huf),0) into paid from public.kastelydomb_payments where order_id=p_order;
 if paid+p_amount>o.total_huf then raise exception 'A befizetés meghaladja a hátralékot.';end if;
 insert into public.kastelydomb_payments(order_id,driver_id,amount_huf,method,request_id) values(p_order,p_driver,p_amount,p_method,p_request) returning * into p;
 update public.kastelydomb_orders set payment_status=case when paid+p_amount=total_huf then 'paid' else 'pending' end,updated_at=now() where id=p_order;
 insert into public.kastelydomb_audit(action,entity_id,details) values('payment_recorded',p_order,jsonb_build_object('payment_id',p.id,'amount_huf',p_amount));return to_jsonb(p);
end$$;
create or replace function public.kd_order_status(p_order uuid,p_status text) returns jsonb language plpgsql security invoker set search_path='' as $$
declare o public.kastelydomb_orders;begin
 perform pg_advisory_xact_lock(8271028);
 select * into o from public.kastelydomb_orders where id=p_order for update;
 if not found then raise exception 'Nincs ilyen rendelés.';end if;
 if p_status is null or p_status not in ('new','confirmed','preparing','ready','completed','cancelled') then raise exception 'Hibás állapot.';end if;
 if o.status='cancelled' or (o.status='completed' and p_status<>'completed') then raise exception 'Lezárt rendelés nem módosítható.';end if;
 if p_status='cancelled' and exists(select 1 from public.kastelydomb_payments where order_id=p_order) then raise exception 'Befizetett rendelés lemondásához visszatérítési egyeztetés szükséges.';end if;
 if p_status='completed' and o.fulfillment='delivery' and not exists(select 1 from public.kastelydomb_assignments where order_id=p_order) then raise exception 'Teljesítéshez futár szükséges.';end if;
 update public.kastelydomb_orders set status=p_status,updated_at=now() where id=p_order returning * into o;
 if p_status='completed' then update public.kastelydomb_assignments set completed_at=now() where order_id=p_order;end if;
 insert into public.kastelydomb_audit(action,entity_id,details) values('order_status',p_order,jsonb_build_object('status',p_status));return to_jsonb(o);
end$$;
create or replace function public.kd_settle(p_driver uuid,p_start date,p_end date) returns jsonb language plpgsql security invoker set search_path='' as $$
declare s public.kastelydomb_settlements;cash bigint;card bigint;unpaid bigint;n integer;begin
 perform pg_advisory_xact_lock(8271028);
 if p_start is null or p_end is null or p_start>p_end or p_end>=(now() at time zone 'Europe/Budapest')::date then raise exception 'Csak lezárult napokra készíthető végleges elszámolás.';end if;
 if not exists(select 1 from public.kastelydomb_drivers where id=p_driver) then raise exception 'Nincs ilyen futár.';end if;
 if exists(select 1 from public.kastelydomb_settlements where driver_id=p_driver and period_start<=p_end and period_end>=p_start) then raise exception 'Az időszak már érint lezárt elszámolást.';end if;
 select coalesce(sum(amount_huf) filter(where method='cash'),0),coalesce(sum(amount_huf) filter(where method='card'),0) into cash,card from public.kastelydomb_payments where driver_id=p_driver and (created_at at time zone 'Europe/Budapest')::date between p_start and p_end;
 select count(*),coalesce(sum(greatest(0,o.total_huf-(select coalesce(sum(p.amount_huf),0) from public.kastelydomb_payments p where p.order_id=o.id and (p.created_at at time zone 'Europe/Budapest')::date<=p_end))),0) into n,unpaid from public.kastelydomb_assignments a join public.kastelydomb_orders o on o.id=a.order_id where a.driver_id=p_driver and o.status<>'cancelled' and (a.assigned_at at time zone 'Europe/Budapest')::date between p_start and p_end;
 insert into public.kastelydomb_settlements(driver_id,period_start,period_end,cash_huf,card_huf,unpaid_huf,order_count) values(p_driver,p_start,p_end,cash,card,unpaid,n) returning * into s;
 insert into public.kastelydomb_audit(action,entity_id) values('settlement_closed',s.id);return to_jsonb(s);
end$$;
create or replace function public.kd_menu(p_start date,p_days jsonb,p_published boolean) returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.kastelydomb_menu_weeks;begin
 if extract(isodow from p_start)<>1 or jsonb_typeof(p_days)<>'array' or jsonb_array_length(p_days)<>5 then raise exception 'Hibás heti menü.';end if;
 insert into public.kastelydomb_menu_weeks(week_start,days,published) values(p_start,p_days,p_published) on conflict(week_start) do update set days=excluded.days,published=excluded.published,updated_at=now() returning * into m;
 insert into public.kastelydomb_audit(action,entity_id,details) values('menu_saved',m.id,jsonb_build_object('published',p_published));return to_jsonb(m);
end$$;
do $$declare f record;begin for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('kd_rate_limit','kd_driver','kd_assign','kd_payment','kd_order_status','kd_settle','kd_menu') loop
 execute format('revoke execute on function %s from public,anon,authenticated',f.signature);
 execute format('grant execute on function %s to service_role',f.signature);
end loop;end$$;
