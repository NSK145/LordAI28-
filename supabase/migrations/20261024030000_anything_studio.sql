create table if not exists public.lord_studio_projects (
  project_id uuid primary key references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal text not null check (char_length(goal) between 3 and 4000),
  spec jsonb not null,
  status text not null default 'ready'
    check (status in ('planning', 'ready', 'failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lord_studio_artifacts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in (
    'website', 'project_plan', 'source_code', 'test_cases',
    'game', 'image', 'launch_checklist', 'user_documentation'
  )),
  title text not null check (char_length(title) between 1 and 160),
  file_name text not null check (char_length(file_name) between 1 and 160),
  mime_type text not null check (char_length(mime_type) between 1 and 120),
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'completed', 'failed', 'stale')),
  content text not null default '',
  dependencies jsonb not null default '[]',
  validation jsonb not null default '{"valid":false,"checks":[]}',
  revision integer not null default 0 check (revision >= 0),
  generation_model text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, project_id, user_id)
);

create table if not exists public.lord_studio_artifact_versions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references public.lord_studio_artifacts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  revision integer not null check (revision > 0),
  content text not null,
  validation jsonb not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (artifact_id, revision)
);

create index if not exists lord_studio_projects_user_updated_idx
  on public.lord_studio_projects(user_id, updated_at desc);
create index if not exists lord_studio_artifacts_project_idx
  on public.lord_studio_artifacts(project_id, user_id, created_at);
create index if not exists lord_studio_artifact_versions_history_idx
  on public.lord_studio_artifact_versions(artifact_id, revision desc);

alter table public.lord_studio_projects enable row level security;
alter table public.lord_studio_artifacts enable row level security;
alter table public.lord_studio_artifact_versions enable row level security;

create policy "Users manage own LORD Studio projects"
  on public.lord_studio_projects for all
  using (
    auth.uid() = user_id and exists (
      select 1 from public.projects project
      where project.id = project_id and project.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.projects project
      where project.id = project_id and project.user_id = auth.uid()
    )
  );

create policy "Users manage own LORD Studio artifacts"
  on public.lord_studio_artifacts for all
  using (
    auth.uid() = user_id and exists (
      select 1 from public.projects project
      where project.id = project_id and project.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.projects project
      where project.id = project_id and project.user_id = auth.uid()
    )
  );

create policy "Users manage own LORD Studio artifact versions"
  on public.lord_studio_artifact_versions for all
  using (
    auth.uid() = user_id and exists (
      select 1 from public.lord_studio_artifacts artifact
      where artifact.id = artifact_id and artifact.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id and exists (
      select 1 from public.lord_studio_artifacts artifact
      where artifact.id = artifact_id and artifact.user_id = auth.uid()
    )
  );
