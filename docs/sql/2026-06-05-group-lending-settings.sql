create table if not exists public.group_lending_settings (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  group_name text not null,
  region text not null check (region in ('USA', 'UAE')),
  currency text not null check (currency in ('USD', 'AED')),
  recommended_amount numeric(14, 2) not null default 0,
  final_amount numeric(14, 2) not null default 0,
  custom_amount numeric(14, 2) not null default 0,
  effective_amount numeric(14, 2) not null default 0,
  pilot_percent numeric(5, 2) not null default 20,
  pilot_amount numeric(14, 2) generated always as (round((case when custom_amount > 0 then custom_amount else final_amount end) * pilot_percent / 100, 2)) stored,
  quarterly_capacity numeric(14, 2) generated always as (greatest((case when custom_amount > 0 then custom_amount else final_amount end) - round((case when custom_amount > 0 then custom_amount else final_amount end) * pilot_percent / 100, 2), 0)) stored,
  notes text,
  updated_by uuid,
  updated_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_key, region)
);

alter table public.group_lending_settings
  add column if not exists custom_amount numeric(14, 2) not null default 0;

alter table public.group_lending_settings
  add column if not exists effective_amount numeric(14, 2) not null default 0;

create index if not exists group_lending_settings_region_idx
  on public.group_lending_settings (region);

create or replace function public.set_group_lending_settings_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_group_lending_settings_updated_at on public.group_lending_settings;

create trigger trg_group_lending_settings_updated_at
before update on public.group_lending_settings
for each row
execute function public.set_group_lending_settings_updated_at();

alter table public.group_lending_settings enable row level security;

-- No public RLS policies are added intentionally.
-- Reads/writes should go through protected Next.js API routes using the service role.
