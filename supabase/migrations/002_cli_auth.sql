-- CLI Authentication Tables

-- CLI Auth Requests (for browser-based device flow)
-- Temporary table for the auth handshake between CLI and browser
create table public.cli_auth_requests (
  code text primary key, -- device code from CLI
  user_id uuid references public.profiles on delete cascade,
  token text, -- the CLI token once authorized
  status text default 'pending' check (status in ('pending', 'authorized')),
  expires_at timestamp with time zone not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- CLI Tokens (persistent tokens for CLI authentication)
create table public.cli_tokens (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles on delete cascade not null,
  token text unique not null, -- cli_XXXX format
  last_used_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.cli_auth_requests enable row level security;
alter table public.cli_tokens enable row level security;

-- CLI Auth Requests policies (service role only - no user access needed)
-- The server uses service role key to read/write these

-- CLI Tokens policies
create policy "Users can view their own CLI tokens"
  on public.cli_tokens for select
  using (auth.uid() = user_id);

create policy "Users can delete their own CLI tokens"
  on public.cli_tokens for delete
  using (auth.uid() = user_id);

-- Indexes
create index idx_cli_tokens_token on public.cli_tokens(token);
create index idx_cli_tokens_user_id on public.cli_tokens(user_id);
create index idx_cli_auth_requests_expires on public.cli_auth_requests(expires_at);

-- Function to clean up expired auth requests (run periodically)
create or replace function public.cleanup_expired_cli_auth_requests()
returns void as $$
begin
  delete from public.cli_auth_requests where expires_at < now();
end;
$$ language plpgsql security definer;
