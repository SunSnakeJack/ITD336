-- Required by the server-only admin-user-management Edge Function.
-- No browser role receives additional privileges.
grant select on public.roles, public.user_roles, public.profiles to service_role;
grant insert on public.user_roles to service_role;
grant update (account_status) on public.profiles to service_role;
grant insert on public.audit_logs to service_role;
grant usage on sequence public.audit_logs_id_seq to service_role;
