-- Fix applied in Supabase to restore protected admin access.
-- The first migration had inadvertently revoked service_role table privileges.
-- Keep anon and authenticated without table access; the server uses service_role only.
grant select, insert, update, delete on table public.kastelydomb_contacts to service_role;
grant select, insert, update, delete on table public.kastelydomb_reservations to service_role;
notify pgrst, 'reload schema';
