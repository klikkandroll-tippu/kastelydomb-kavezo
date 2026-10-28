-- REVIEW / REHEARSAL ONLY. User approval is required AFTER client testing.
-- This script intentionally rolls back. Do not change the final ROLLBACK
-- to COMMIT until the user explicitly approves test-data removal and real launch.
begin;
do $$ begin
 if exists(select 1 from public.kastelydomb_payments p join public.kastelydomb_orders o on o.id=p.order_id where p.is_test is distinct from o.is_test)
 or exists(select 1 from public.kastelydomb_assignments a join public.kastelydomb_orders o on o.id=a.order_id join public.kastelydomb_drivers d on d.id=a.driver_id where a.is_test is distinct from o.is_test or a.is_test is distinct from d.is_test)
 or exists(select 1 from public.kastelydomb_settlements s join public.kastelydomb_drivers d on d.id=s.driver_id where s.is_test is distinct from d.is_test)
 then raise exception 'Mixed test/real relationships: manual review required'; end if;
end $$;
-- The affected rows can be previewed before any deletion.
select 'orders' as entity,count(*) as test_rows from public.kastelydomb_orders where is_test
union all select 'drivers',count(*) from public.kastelydomb_drivers where is_test
union all select 'payments',count(*) from public.kastelydomb_payments where is_test
union all select 'menus',count(*) from public.kastelydomb_menu_weeks where is_test;
delete from public.kastelydomb_audit where is_test;
delete from public.kastelydomb_payments where is_test;
delete from public.kastelydomb_assignments where is_test;
delete from public.kastelydomb_settlements where is_test;
delete from public.kastelydomb_orders where is_test;
delete from public.kastelydomb_drivers where is_test;
delete from public.kastelydomb_menu_weeks where is_test;
do $$ declare t text; begin foreach t in array array['kastelydomb_orders','kastelydomb_drivers','kastelydomb_assignments','kastelydomb_payments','kastelydomb_settlements','kastelydomb_menu_weeks','kastelydomb_audit'] loop
 execute format('alter table public.%I alter column is_test set default false',t);
end loop;end $$;
-- Real activation also requires KASTELYDOMB_MODE=production and
-- ORDER_INTAKE_ENABLED=true, after approved real menus and driver records exist.
rollback;
