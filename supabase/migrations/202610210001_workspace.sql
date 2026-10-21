-- Production foundation only. The local prototype does not connect to this schema.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '' check (length(name) <= 100),
  target_role text not null default '' check (length(target_role) <= 150),
  daily_minutes integer not null default 60 check (daily_minutes between 15 and 480),
  timezone text not null default 'Asia/Bangkok',
  preferred_language text not null default 'th' check (preferred_language in ('th', 'en')),
  created_at timestamptz not null default now()
);

create table public.user_skills (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  skill text not null check (length(skill) between 1 and 100),
  self_level integer not null check (self_level between 0 and 4),
  evidence_url text,
  reviewed_at timestamptz not null default now(),
  unique (user_id, skill)
);

create table public.job_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 150),
  company text not null check (length(company) between 1 and 150),
  source_url text,
  canonical_url text,
  source_name text not null default 'Manual',
  location text not null default '',
  work_mode text not null default 'Unknown' check (work_mode in ('Remote', 'Hybrid', 'On-site', 'Unknown')),
  notes text not null default '' check (length(notes) <= 5000),
  jd text not null default '' check (length(jd) <= 20000),
  content_consent boolean not null default false,
  analyzed boolean not null default false,
  created_at timestamptz not null default now(),
  check (jd = '' or content_consent),
  unique (id, user_id)
);
create unique index job_posts_owner_canonical_url on public.job_posts(user_id, canonical_url)
  where canonical_url is not null and canonical_url <> '';

create table public.job_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  source_url text,
  method text not null default 'manual' check (method = 'manual'),
  consent_basis text,
  imported_at timestamptz not null default now(),
  foreign key (job_id, user_id) references public.job_posts(id, user_id) on delete cascade
);

create table public.job_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null,
  skill text not null,
  priority text not null check (priority in ('must_have', 'nice_to_have', 'unclear')),
  source_quote text not null,
  start_utf16 integer not null check (start_utf16 >= 0),
  end_utf16 integer not null check (end_utf16 >= start_utf16),
  confidence numeric not null check (confidence between 0 and 1),
  parser_version text not null,
  approved_at timestamptz,
  foreign key (job_id, user_id) references public.job_posts(id, user_id) on delete cascade,
  unique (job_id, skill)
);

create table public.learning_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  skill text not null,
  minutes integer not null check (minutes between 1 and 480),
  scheduled_date date not null,
  done boolean not null default false,
  proof_url text,
  completion_criteria text not null,
  unique (id, user_id)
);
create table public.learning_task_jobs (
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid not null,
  job_id uuid not null,
  primary key (task_id, job_id),
  foreign key (task_id, user_id) references public.learning_tasks(id, user_id) on delete cascade,
  foreign key (job_id, user_id) references public.job_posts(id, user_id) on delete cascade
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Nullable link deliberately preserves user's application history when a job is deleted.
  job_id uuid,
  company text not null check (length(company) between 1 and 150),
  role_title text not null check (length(role_title) between 1 and 150),
  status text not null default 'preparing' check (status in ('saved','preparing','applied','screening','assessment','interview','offer','hired','rejected','withdrawn','archived')),
  notes text not null default '',
  follow_up date,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (job_id, user_id) references public.job_posts(id, user_id) on delete set null (job_id),
  unique (id, user_id)
);
create table public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null,
  from_status text check (from_status in ('saved','preparing','applied','screening','assessment','interview','offer','hired','rejected','withdrawn','archived')),
  to_status text not null check (to_status in ('saved','preparing','applied','screening','assessment','interview','offer','hired','rejected','withdrawn','archived')),
  actor text not null default 'user' check (actor = 'user'),
  notes text not null default '',
  occurred_at timestamptz not null default now(),
  foreign key (application_id, user_id) references public.applications(id, user_id) on delete cascade
);
create table public.consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  scope text not null,
  policy_version text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);

create index learning_tasks_owner_date on public.learning_tasks(user_id, scheduled_date);
create index applications_owner_status on public.applications(user_id, status);
create index applications_owner_follow_up on public.applications(user_id, follow_up);
create index job_imports_owner_job on public.job_imports(user_id, job_id);
create index job_requirements_owner_job on public.job_requirements(user_id, job_id);
create index application_events_owner_application on public.application_events(user_id, application_id);

-- No anon access. Both USING and WITH CHECK protect ownership on all mutations.
do $$
declare table_name text;
begin
  foreach table_name in array array['profiles','user_skills','job_posts','job_imports','job_requirements','learning_tasks','learning_task_jobs','applications','application_events','consents'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('alter table public.%I force row level security', table_name);
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('create policy owner_access on public.%I for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
  end loop;
end $$;
commit;
