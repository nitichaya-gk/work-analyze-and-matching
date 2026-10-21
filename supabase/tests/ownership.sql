-- Run AFTER migrations against a disposable Supabase dev database as postgres:
-- psql "$DEV_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ownership.sql
-- Transaction rolls back all fixtures. Any unexpected success raises an error.
begin;
insert into auth.users(id) values
 ('10000000-0000-0000-0000-000000000001'),
 ('10000000-0000-0000-0000-000000000002');
insert into public.job_posts(id,user_id,title,company) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','A role','Fixture A'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','B role','Fixture B');
insert into public.job_imports(id,user_id,job_id) values
 ('30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
do $$
declare affected integer;
begin
  if (select count(*) from public.job_posts) <> 1 then raise exception 'Cross-user read leaked'; end if;
  update public.job_posts set title='Forbidden' where id='20000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user update succeeded'; end if;
  delete from public.job_posts where id='20000000-0000-0000-0000-000000000002';
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-user delete succeeded'; end if;
  begin
    insert into public.job_posts(user_id,title,company) values ('10000000-0000-0000-0000-000000000002','Forbidden','Fixture');
    raise exception 'Cross-user insert succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.job_posts set user_id='10000000-0000-0000-0000-000000000002' where id='20000000-0000-0000-0000-000000000001';
    raise exception 'Owner reassignment succeeded';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.job_imports set job_id='20000000-0000-0000-0000-000000000002' where id='30000000-0000-0000-0000-000000000001';
    raise exception 'Child reparenting succeeded';
  exception when foreign_key_violation then null;
  end;
  begin
    insert into public.applications(user_id,job_id,company,role_title) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002','Forbidden','Fixture');
    raise exception 'Cross-user application link succeeded';
  exception when foreign_key_violation then null;
  end;
  insert into public.applications(user_id,job_id,company,role_title) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Fixture A','Allowed');
  delete from public.job_posts where id='20000000-0000-0000-0000-000000000001';
  if not exists (select 1 from public.applications where job_id is null) then raise exception 'Application history lost'; end if;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
do $$
begin
  if (select count(*) from public.job_posts) <> 1 then raise exception 'User B lost their job'; end if;
  if exists (select 1 from public.applications) then raise exception 'User B can see A applications'; end if;
end $$;
rollback;
