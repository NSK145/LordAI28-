create table if not exists public.pro_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'inactive' check (status in ('inactive','active','cancelled','expired')),
  plan text check (plan in ('monthly','yearly','lifetime')),
  expires_at timestamptz,
  razorpay_subscription_id text unique,
  updated_at timestamptz not null default now()
);
alter table public.pro_entitlements enable row level security;
create policy "Users can read own Pro entitlement" on public.pro_entitlements
  for select using (auth.uid() = user_id);

create table if not exists public.pro_billing_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_subscription_id text not null,
  razorpay_payment_id text unique,
  event_type text not null,
  amount integer,
  currency text not null default 'INR',
  created_at timestamptz not null default now()
);
alter table public.pro_billing_events enable row level security;
create policy "Users can read own billing events" on public.pro_billing_events
  for select using (auth.uid() = user_id);
