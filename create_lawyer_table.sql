-- Create the lawyer_requests table for the new Advocate Requests module
create table if not exists lawyer_requests (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  case_number text,
  contact_method text,
  matter text check (matter in ('Cível', 'Criminal', 'Outros')),
  request_date date not null,
  is_concluded boolean default false,
  concluded_at timestamp with time zone,
  obs text,
  user_id uuid not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  deleted_at timestamp with time zone
);

-- Create index for performance
create index if not exists idx_lawyer_requests_user_id on lawyer_requests(user_id);
create index if not exists idx_lawyer_requests_deleted_at on lawyer_requests(deleted_at);

-- Enable RLS (Optional but recommended, though current app might not use policies yet)
alter table lawyer_requests enable row level security;

-- Create policy to allow all actions for authenticated users (assuming simple auth model)
create policy "Enable all for authenticated users" on lawyer_requests
  for all using (auth.role() = 'authenticated');
