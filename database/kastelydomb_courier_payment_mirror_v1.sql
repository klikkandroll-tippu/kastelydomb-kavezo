-- Applied to Supabase on 2026-11-09.
-- Keep the courier cash/card collection ledger and menu-order payment ledger
-- in one database transaction. This trigger only mirrors a newly collected
-- menu delivery; special-order collection remains in daily delivery_progress.
create or replace function public.kd_mirror_courier_collection()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_order_total integer;
begin
 if new.kind <> 'menu' or old.collected_at is not null or new.collected_at is null then return new; end if;
 if new.collected_amount_huf is null then raise exception 'Missing collection amount'; end if;
 if exists(select 1 from public.kastelydomb_payments
           where order_id=new.order_id and coalesce(note,'') not like 'Futár – %')
   then raise exception 'Prior payment exists; financial reconciliation required'; end if;
 select total_huf into v_order_total from public.kastelydomb_orders where id=new.order_id;
 if coalesce((select sum(amount_huf) from public.kastelydomb_payments
              where order_id=new.order_id),0)+new.collected_amount_huf > v_order_total
    then raise exception 'Collection would exceed order total'; end if;
 if new.collected_amount_huf > 0 then
  insert into public.kastelydomb_payments
    (order_id,amount_huf,method,note,request_id,is_test)
  values(new.order_id,new.collected_amount_huf,new.payment_method,
         'Futár – '||new.delivery_date::text,
         md5('kastelydomb:courier:'||new.order_id::text||':'||new.delivery_date::text)::uuid,
         new.is_test)
  on conflict (request_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.kd_mirror_courier_collection() from public,anon,authenticated;
drop trigger if exists kd_courier_collection_payment on public.kastelydomb_delivery_progress;
create trigger kd_courier_collection_payment
after update of collected_at on public.kastelydomb_delivery_progress
for each row when (old.collected_at is null and new.collected_at is not null)
execute function public.kd_mirror_courier_collection();
