-- Applied to Kastelydomb Supabase project in Preview development.
-- Payment state for a delivery is per DAY, not duplicated across a multi-day menu order.
create table if not exists public.kastelydomb_delivery_progress (
  kind text not null check(kind in ('menu','special')),
  order_id uuid not null,
  delivery_date date not null,
  delivered_at timestamptz,
  collected_at timestamptz,
  settled_at timestamptz,
  collected_amount_huf integer check(collected_amount_huf>=0),
  payment_method text check(payment_method in ('cash','card')),
  is_test boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key(kind,order_id,delivery_date)
);
alter table public.kastelydomb_delivery_progress enable row level security;
revoke all on public.kastelydomb_delivery_progress from anon,authenticated;
grant select,insert,update on public.kastelydomb_delivery_progress to service_role;
create or replace function public.kd_delivery_step(
 p_kind text,p_order uuid,p_date date,p_action text,p_amount integer default null,p_payment text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare o record; line jsonb; expected integer:=0; lines integer:=0; missing integer:=0; prog record; payment text;
begin
 if auth.role()<>'service_role' then raise exception 'unauthorized'; end if;
 if p_kind not in ('menu','special') or p_action not in ('delivered','collected','settled')
   or p_date is null or p_order is null then raise exception 'invalid data'; end if;
 if p_kind='menu' then
   select id,items,fulfillment,payment_method,total_huf,status,is_test into o
   from public.kastelydomb_orders where id=p_order for update;
 else
   select id,items,fulfillment,payment_method,total_huf,status,is_test into o
   from public.kastelydomb_christmas_orders where id=p_order for update;
 end if;
 if not found or o.fulfillment<>'delivery' or o.status='cancelled'
   then raise exception 'not a deliverable order'; end if;
 if p_kind='menu' then
   for line in select value from jsonb_array_elements(o.items)
     where value->>'date'=p_date::text loop
     lines:=lines+1;
     if not (line ? 'line_total_huf') then missing:=missing+1;
     else expected:=expected+(line->>'line_total_huf')::integer;end if;
   end loop;
   if lines=0 then raise exception 'No order items for this date'; end if;
 else
   if p_date<>'2026-12-24'::date then raise exception 'Wrong special delivery date'; end if;
   expected:=o.total_huf;
 end if;
 insert into public.kastelydomb_delivery_progress(kind,order_id,delivery_date,is_test)
 values (p_kind,p_order,p_date,o.is_test)
 on conflict do nothing;
 select * into prog from public.kastelydomb_delivery_progress
 where kind=p_kind and order_id=p_order and delivery_date=p_date for update;
 if p_action='delivered' then
   update public.kastelydomb_delivery_progress set delivered_at=coalesce(delivered_at,now()),updated_at=now()
   where kind=p_kind and order_id=p_order and delivery_date=p_date;
 elsif p_action='collected' then
   if prog.delivered_at is null then raise exception 'Mark delivery first'; end if;
   if prog.collected_at is null then
     if missing>0 then raise exception 'Legacy order requires manual price reconciliation'; end if;
     if o.payment_method in ('online_card','company_transfer') then raise exception 'Prepaid/transfer orders cannot be collected by courier'; end if;
     if p_amount is null or p_amount<>expected then raise exception 'Collection amount must match the exact day total'; end if;
     payment:=case when o.payment_method in ('cash_on_pickup','cash') then 'cash' else 'card' end;
     if p_payment is distinct from payment then raise exception 'Payment method differs from selected method'; end if;
     update public.kastelydomb_delivery_progress
     set collected_at=now(),collected_amount_huf=p_amount,payment_method=payment,updated_at=now()
     where kind=p_kind and order_id=p_order and delivery_date=p_date;
   end if;
 elsif p_action='settled' then
   if prog.collected_at is null then raise exception 'Courier has not collected payment'; end if;
   update public.kastelydomb_delivery_progress set settled_at=coalesce(settled_at,now()),updated_at=now()
   where kind=p_kind and order_id=p_order and delivery_date=p_date;
 end if;
 return (select to_jsonb(t) from public.kastelydomb_delivery_progress t
 where kind=p_kind and order_id=p_order and delivery_date=p_date);
end $$;
revoke all on function public.kd_delivery_step(text,uuid,date,text,integer,text) from public,anon,authenticated;
grant execute on function public.kd_delivery_step(text,uuid,date,text,integer,text) to service_role;
notify pgrst,'reload schema';
