-- Create an enum for device types
create type device_type as enum ('Thermostat', 'Light', 'Lock', 'Camera');

-- Create an enum for device status
create type device_status as enum ('Normal', 'Warning', 'High', 'Error');

-- Enable Row Level Security
create table public.devices (
    id uuid default gen_random_uuid() primary key,
    title text not null,
    type device_type not null,
    value numeric not null,
    unit text not null,
    status device_status not null default 'Normal',
    auto_update boolean not null default false,
    user_id uuid references auth.users(id) on delete cascade not null,
    -- GitHub integration fields
    repo_url text,
    repo_branch text default 'main',
    repo_path text,
    github_token text,
    github_username text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes
create index devices_user_id_idx on public.devices(user_id);
create index devices_created_at_idx on public.devices(created_at desc);

-- Enable Row Level Security
alter table public.devices enable row level security;

-- Create policies
-- Allow users to view their own devices
create policy "Users can view their own devices"
    on public.devices
    for select
    using (auth.uid() = user_id);

-- Allow users to insert their own devices
create policy "Users can insert their own devices"
    on public.devices
    for insert
    with check (auth.uid() = user_id);

-- Allow users to update their own devices
create policy "Users can update their own devices"
    on public.devices
    for update
    using (auth.uid() = user_id)
    with check (auth.uid() = user_id);

-- Allow users to delete their own devices
create policy "Users can delete their own devices"
    on public.devices
    for delete
    using (auth.uid() = user_id);

-- Create function to automatically update the updated_at timestamp
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger to automatically update the updated_at timestamp
create trigger update_devices_updated_at
    before update on public.devices
    for each row
    execute function public.update_updated_at_column();
