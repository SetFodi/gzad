-- Who may add and remove screens from the admin panel.
--
-- Being an admin is not enough: partner companies have admin accounts too,
-- and adding a screen admits a new controller to the realtime server. The
-- table has row level security and no policies, so only the service role
-- (the app's server routes) can read or change it.

create table if not exists public.device_managers (
  client_id  uuid        primary key references public.clients(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.device_managers enable row level security;
