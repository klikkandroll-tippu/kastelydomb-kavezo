begin;
set local role service_role;
do $$
declare o uuid:=gen_random_uuid();d uuid;p jsonb;s jsonb;k uuid:=gen_random_uuid();v integer;begin
 insert into public.kastelydomb_orders(id,order_number,customer_name,customer_phone,customer_type,fulfillment,payment_method,total_huf,items) values(o,'TEST-'||o,'Teszt Vendég','+36300000000','private','delivery','cash_on_pickup',5000,'[]');
 d:=(public.kd_driver(null,'Teszt Futár','+36300000000','Teszt',true)->>'id')::uuid;
 perform public.kd_assign(o,d);
 perform public.kd_payment(o,d,2000,'cash',k);
 perform public.kd_payment(o,d,2000,'cash',k);
 select count(*) into v from public.kastelydomb_payments where order_id=o;
 assert v=1,'Ismételt kérés duplikálódott';
 assert (select payment_status='pending' from public.kastelydomb_orders where id=o),'Részfizetés';
 begin perform public.kd_payment(o,d,4000,'cash',gen_random_uuid());raise exception 'Túlfizetés átment';exception when raise_exception then if sqlerrm='Túlfizetés átment' then raise;end if;end;
 begin perform public.kd_order_status(o,'cancelled');raise exception 'Fizetett rendelés lemondható';exception when raise_exception then if sqlerrm='Fizetett rendelés lemondható' then raise;end if;end;
 perform public.kd_payment(o,d,3000,'card',gen_random_uuid());
 assert (select payment_status='paid' from public.kastelydomb_orders where id=o),'Teljes fizetés';
 perform public.kd_order_status(o,'completed');
 assert (select completed_at is not null from public.kastelydomb_assignments where order_id=o),'Teljesítési idő';
 -- Historical settlement fixture; all changes roll back.
 update public.kastelydomb_payments set created_at=now()-interval '2 days' where order_id=o;
 update public.kastelydomb_assignments set assigned_at=now()-interval '2 days' where order_id=o;
 s:=public.kd_settle(d,(now() at time zone 'Europe/Budapest')::date-3,(now() at time zone 'Europe/Budapest')::date-1);
 assert (s->>'cash_huf')::int=2000 and (s->>'card_huf')::int=3000 and (s->>'unpaid_huf')::int=0,'Elszámolás összege';
 begin perform public.kd_settle(d,(now() at time zone 'Europe/Budapest')::date-2,(now() at time zone 'Europe/Budapest')::date-1);raise exception 'Átfedő elszámolás átment';exception when raise_exception then if sqlerrm='Átfedő elszámolás átment' then raise;end if;end;
 assert public.kd_rate_limit('test-rate',1,60),'Első kérés';
 assert not public.kd_rate_limit('test-rate',1,60),'Rate limit';
 assert not has_function_privilege('anon','public.kd_payment(uuid,uuid,integer,text,uuid)','EXECUTE'),'Anon RPC';
 assert not has_table_privilege('authenticated','public.kastelydomb_admin_sessions','SELECT'),'Munkamenet adatvédelem';
end$$;
select 'PASS: partial/full payment, idempotency, overpayment, cancellation, assignment, completion, settlement, overlap, rate limit, role restrictions' as result;
rollback;
