-- Applied in Supabase, 2026-11-08.
-- Uniqueness protects repeat order POSTs; NULL is permitted for legacy rows.
create unique index if not exists kd_menu_request_fingerprint_unique on public.kastelydomb_orders(request_fingerprint);
create unique index if not exists kd_christmas_request_fingerprint_unique on public.kastelydomb_christmas_orders(request_fingerprint);
create table if not exists public.kastelydomb_notification_outbox (
 request_id uuid primary key,
 source text not null check (source in ('menu','christmas','contact','reservation')),
 state text not null default 'pending' check (state in ('pending','sending','sent','uncertain','failed')),
 attempts integer not null default 0,
 started_at timestamptz,
 sent_at timestamptz,
 last_error text,
 is_test boolean not null default true,
 created_at timestamptz not null default now()
);
alter table public.kastelydomb_notification_outbox enable row level security;
revoke all on public.kastelydomb_notification_outbox from anon,authenticated;
grant select,insert,update on public.kastelydomb_notification_outbox to service_role;
create or replace function public.kd_claim_notification(p_request_id uuid,p_source text)
returns text language plpgsql security definer set search_path=public as $$
declare v_state text;
begin
 if auth.role()<>'service_role' then raise exception 'unauthorized'; end if;
 insert into public.kastelydomb_notification_outbox(request_id,source,is_test) values(p_request_id,p_source,true) on conflict(request_id) do nothing;
 select state into v_state from public.kastelydomb_notification_outbox where request_id=p_request_id and source=p_source for update;
 if not found then raise exception 'source mismatch'; end if;
 if v_state='sent' then return 'sent'; end if;
 if v_state<>'pending' then return 'review'; end if;
 update public.kastelydomb_notification_outbox set state='sending',started_at=now(),attempts=attempts+1 where request_id=p_request_id;
 return 'send';
end $$;
revoke all on function public.kd_claim_notification(uuid,text) from public,anon,authenticated;
grant execute on function public.kd_claim_notification(uuid,text) to service_role;
notify pgrst, 'reload schema';
