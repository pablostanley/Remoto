-- Remoto Database Schema

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  avatar_url text,
  plan text default 'free' check (plan in ('free', 'pro', 'team')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- API Keys for CLI authentication
create table public.api_keys (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  name text not null,
  key_hash text not null unique,
  key_preview text not null, -- First 8 chars for display (e.g., "rmt_abc1...")
  is_active boolean default true,
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sessions history
create table public.sessions (
  id text primary key, -- nanoid from server
  user_id uuid references public.profiles on delete cascade not null,
  status text default 'active' check (status in ('active', 'ended')),
  started_at timestamp with time zone default timezone('utc'::text, now()) not null,
  ended_at timestamp with time zone,
  duration_seconds integer generated always as (
    case when ended_at is not null
    then extract(epoch from (ended_at - started_at))::integer
    else null end
  ) stored
);

-- Usage tracking (for billing)
create table public.usage (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  period_start date not null,
  period_end date not null,
  session_count integer default 0,
  total_duration_seconds integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(user_id, period_start)
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.api_keys enable row level security;
alter table public.sessions enable row level security;
alter table public.usage enable row level security;

-- Profiles policies
create policy "Users can view their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- API Keys policies
create policy "Users can view their own API keys"
  on public.api_keys for select
  using (auth.uid() = user_id);

create policy "Users can create their own API keys"
  on public.api_keys for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own API keys"
  on public.api_keys for update
  using (auth.uid() = user_id);

create policy "Users can delete their own API keys"
  on public.api_keys for delete
  using (auth.uid() = user_id);

-- Sessions policies
create policy "Users can view their own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

-- Usage policies
create policy "Users can view their own usage"
  on public.usage for select
  using (auth.uid() = user_id);

-- Function to create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Function to update usage when session ends
create or replace function public.update_usage_on_session_end()
returns trigger as $$
declare
  period_start_date date;
begin
  if new.status = 'ended' and old.status = 'active' then
    period_start_date := date_trunc('month', new.started_at)::date;

    insert into public.usage (user_id, period_start, period_end, session_count, total_duration_seconds)
    values (
      new.user_id,
      period_start_date,
      (period_start_date + interval '1 month' - interval '1 day')::date,
      1,
      coalesce(new.duration_seconds, 0)
    )
    on conflict (user_id, period_start) do update set
      session_count = public.usage.session_count + 1,
      total_duration_seconds = public.usage.total_duration_seconds + coalesce(new.duration_seconds, 0);
  end if;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to update usage
create trigger on_session_status_change
  after update on public.sessions
  for each row execute procedure public.update_usage_on_session_end();

-- Indexes for performance
create index idx_api_keys_user_id on public.api_keys(user_id);
create index idx_api_keys_key_hash on public.api_keys(key_hash);
create index idx_sessions_user_id on public.sessions(user_id);
create index idx_sessions_status on public.sessions(status);
create index idx_usage_user_period on public.usage(user_id, period_start);
