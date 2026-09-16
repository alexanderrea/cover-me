-- Migration: per-user Anthropic API keys.
--
-- ⚠️  YOU PROBABLY DON'T NEED THIS FILE.
--
-- Run it ONLY if your database was created from an older schema.sql that
-- predates the anthropic_key_* columns. A fresh install gets those columns
-- from schema.sql already — run that instead, and skip this.
--
-- This must run AFTER schema.sql. It alters public.profiles; it cannot
-- create it.

do $$
begin
  if to_regclass('public.profiles') is null then
    raise exception
      'public.profiles does not exist. Run supabase/schema.sql first — it already includes these columns, so you can then skip this migration.';
  end if;
end $$;

alter table public.profiles
  add column if not exists anthropic_key_cipher text,  -- AES-256-GCM, see lib/crypto.ts
  add column if not exists anthropic_key_hint   text,  -- "sk-ant-…9f2a", safe to show
  add column if not exists anthropic_key_set_at timestamptz;

comment on column public.profiles.anthropic_key_cipher is
  'Encrypted with ENCRYPTION_KEY. Never sent to the browser.';
