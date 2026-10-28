-- The dedicated Kastelydomb project currently contains client-test fixtures only.
-- Keep this marker until the user approves final cleanup and real operations.
do $$ declare t text; begin
 foreach t in array array['kastelydomb_orders','kastelydomb_drivers','kastelydomb_assignments','kastelydomb_payments','kastelydomb_settlements','kastelydomb_menu_weeks','kastelydomb_audit']
 loop execute format('alter table public.%I add column if not exists is_test boolean not null default true',t);
 end loop;
end $$;
