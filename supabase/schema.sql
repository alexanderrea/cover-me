-- COVER ME — database schema.
-- Paste this whole file into the Supabase SQL editor and run it once.

-- ---------------------------------------------------------------------------
-- profiles: the "about you" half of every letter.
-- One row per signed-in user, keyed to auth.users.
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id            uuid primary key references auth.users on delete cascade,
  full_name     text,
  email         text,
  phone         text,
  location      text,
  headline      text,          -- "Design director, 12 years, brand + product"
  linkedin_url  text,
  portfolio_url text,
  linkedin_text text,          -- pasted LinkedIn profile / data export
  resume_text   text,          -- extracted plain text of the uploaded resume
  resume_name   text,          -- original filename, shown in the UI
  notes         text,          -- standing instructions: "never call me a guru"

  -- The user's own Anthropic API key. Encrypted with ENCRYPTION_KEY
  -- (see lib/crypto.ts) and never sent to the browser — only the hint is.
  anthropic_key_cipher text,
  anthropic_key_hint   text,     -- "sk-ant-…9f2a", safe to display
  anthropic_key_set_at timestamptz,

  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- letters: one generated cover letter, plus what it was generated from.
-- ---------------------------------------------------------------------------
create table if not exists public.letters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  company     text,
  role        text,
  job_url     text,
  job_text    text not null,
  tone        int  not null default 50,   -- 0 reserved … 100 bold
  length      int  not null default 50,   -- 0 short … 100 long
  research    jsonb,                      -- { brief, sources: [{title, url}] }
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists letters_user_created_idx
  on public.letters (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row level security: you can only ever touch your own rows.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.letters  enable row level security;

drop policy if exists "own profile" on public.profiles;
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "own letters" on public.letters;
create policy "own letters" on public.letters
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Give every new Google sign-in a profile row, pre-filled with what Google
-- already told us, so /profile is never an empty form.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
