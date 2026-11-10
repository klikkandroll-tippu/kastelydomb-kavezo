-- Applied in project snxlismmgzwpxerenwsv on 2026-11-08.
-- Public, human-readable form code: KF/NM/AF/KR - YYMMDD - four-digit per-type daily sequence.
create table if not exists public.kastelydomb_form_counters(
 prefix text not null check(prefix in ('KF','NM','AF','KR')),
 local_date date not null,
 last_value integer not null check(last_value between 1 and 9999),
 primary key(prefix,local_date)
);
create table if not exists public.kastelydomb_form_identifiers(
 request_id uuid primary key,
 prefix text not null check(prefix in ('KF','NM','AF','KR')),
 form_number text not null unique,
 created_at timestamptz not null default now()
);
alter table public.kastelydomb_form_counters enable row level security;
alter table public.kastelydomb_form_identifiers enable row level security;
revoke all on public.kastelydomb_form_counters, public.kastelydomb_form_identifiers from anon,authenticated;
grant select,insert,update on public.kastelydomb_form_counters,public.kastelydomb_form_identifiers to service_role;
create or replace function public.kd_issue_form_number(p_request_id uuid,p_prefix text)
returns text language plpgsql security definer set search_path=public as $$
declare v_existing text; v_existing_prefix text; v_day date; v_counter integer; v_code text;
begin
 if auth.role()<>'service_role' then raise exception 'unauthorized'; end if;
 if p_prefix not in ('KF','NM','AF','KR') then raise exception 'invalid prefix'; end if;
 perform pg_advisory_xact_lock(hashtext('kastelydomb_form:'||p_request_id::text));
 select form_number,prefix into v_existing,v_existing_prefix from public.kastelydomb_form_identifiers where request_id=p_request_id;
 if found then
   if v_existing_prefix<>p_prefix then raise exception 'request type mismatch'; end if;
   return v_existing;
 end if;
 v_day:=(now() at time zone 'Europe/Budapest')::date;
 insert into public.kastelydomb_form_counters(prefix,local_date,last_value)
 values(p_prefix,v_day,1)
 on conflict(prefix,local_date) do update
 set last_value=public.kastelydomb_form_counters.last_value+1
 returning last_value into v_counter;
 if v_counter>9999 then raise exception 'daily counter exhausted'; end if;
 v_code:=p_prefix||'-'||to_char(v_day,'YYMMDD')||'-'||lpad(v_counter::text,4,'0');
 insert into public.kastelydomb_form_identifiers(request_id,prefix,form_number)
 values(p_request_id,p_prefix,v_code);
 return v_code;
end $$;
revoke all on function public.kd_issue_form_number(uuid,text) from public,anon,authenticated;
grant execute on function public.kd_issue_form_number(uuid,text) to service_role;
alter table public.kastelydomb_contacts add column if not exists form_number text;
alter table public.kastelydomb_reservations add column if not exists form_number text;
alter table public.kastelydomb_contacts add column if not exists confirmed_at timestamptz;
alter table public.kastelydomb_orders add column if not exists confirmed_at timestamptz;
alter table public.kastelydomb_christmas_orders add column if not exists confirmed_at timestamptz;
create unique index if not exists kd_contacts_form_number_uq on public.kastelydomb_contacts(form_number) where form_number is not null;
create unique index if not exists kd_reservations_form_number_uq on public.kastelydomb_reservations(form_number) where form_number is not null;
notify pgrst,'reload schema';

-- Legacy test contact requests with no number can be safely backfilled using
-- stable request_id and the same RPC; current integration test entry was backfilled
-- to KF-261108-0001. Existing MENU-… test order references are deliberately
-- kept unchanged so previously-sent emails continue to match.
