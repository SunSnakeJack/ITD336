-- Install an inactive job. Activation requires verified sender and backlog review.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create or replace function public.dispatch_scheduled_emails()
returns void language plpgsql security definer set search_path='' as $$
declare v_url text;v_secret text;
begin
 if session_user not in ('postgres','supabase_admin') and coalesce(auth.role(),'')<>'service_role' then
  raise exception 'FORBIDDEN' using errcode='42501';
 end if;
 select decrypted_secret into v_url from vault.decrypted_secrets where name='email_worker_url';
 select decrypted_secret into v_secret from vault.decrypted_secrets where name='email_worker_cron_secret';
 if v_url is null or v_secret is null then raise exception 'EMAIL_SCHEDULER_CONFIGURATION_MISSING';end if;
 perform net.http_post(url:=v_url,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),body:='{}'::jsonb);
end $$;
revoke all on function public.dispatch_scheduled_emails() from public,anon,authenticated;
grant execute on function public.dispatch_scheduled_emails() to service_role;
do $$ declare v_job bigint;begin
 select cron.schedule('itd336-email-worker','* * * * *','select public.dispatch_scheduled_emails()') into v_job;
 perform cron.alter_job(v_job,active:=false);
end $$;
