-- Run against a disposable database with migrations applied.
begin;
do $$
declare
  v_columns text[];
begin
  assert not has_table_privilege('anon', 'public.key_request_lecturers', 'SELECT');
  assert not has_table_privilege('authenticated', 'public.key_request_lecturers', 'SELECT');
  assert (select count(*) = 3 from public.get_public_key_request_lecturers());
  select array_agg(k order by k) into v_columns
    from public.get_public_key_request_lecturers() l
    cross join lateral jsonb_object_keys(to_jsonb(l)) k
    where l.lecturer_name = 'sufeeyan(test)';
  assert v_columns = array['id', 'lecturer_name'], 'Public options must exclude emails and course data';
  assert exists (select 1 from public.key_request_lecturers
    where name = 'sufeeyan(test)' and email = 'sufeeyan2003@gmail.com');
end;
$$;
rollback;
