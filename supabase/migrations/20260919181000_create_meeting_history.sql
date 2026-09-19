create table if not exists public.meeting_history (
  id uuid primary key,
  created_at timestamptz not null default now(),
  title text not null,
  date date not null,
  attendees text[] not null default '{}',
  status text not null check (status in ('scheduled', 'draft')),
  fit_score integer not null check (fit_score between 0 and 100),
  conflict_count integer not null check (conflict_count >= 0),
  attendee_conflict_counts jsonb not null default '{}'::jsonb,
  constraints jsonb not null,
  slot jsonb not null,
  agenda jsonb
);

create index if not exists meeting_history_created_at_idx
  on public.meeting_history (created_at desc);

alter table public.meeting_history enable row level security;
