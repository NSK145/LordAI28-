create table if not exists public.autopilot_missions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  objective text not null check (char_length(objective) between 1 and 2000),
  status text not null check (
    status in (
      'planning',
      'needs_clarification',
      'needs_approval',
      'planned',
      'running',
      'paused',
      'cancelled',
      'completed',
      'failed'
    )
  ),
  plan jsonb not null,
  result jsonb,
  execution_lease_until timestamptz,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists autopilot_missions_user_updated_idx
  on public.autopilot_missions (user_id, updated_at desc);

alter table public.autopilot_missions enable row level security;

drop policy if exists "Users can read their own autopilot missions"
  on public.autopilot_missions;
create policy "Users can read their own autopilot missions"
  on public.autopilot_missions for select
  using (auth.uid() = user_id);

revoke all on public.autopilot_missions from anon, authenticated;
grant select on public.autopilot_missions to authenticated;
grant all on public.autopilot_missions to service_role;

create or replace function public.set_autopilot_missions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists autopilot_missions_updated_at on public.autopilot_missions;
create trigger autopilot_missions_updated_at
  before update on public.autopilot_missions
  for each row execute function public.set_autopilot_missions_updated_at();
