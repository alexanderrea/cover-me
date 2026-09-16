-- Migration: per-user Anthropic API keys.
-- Run this in the Supabase SQL editor if you created your database from the
-- original schema.sql. New installs get these columns already.

alter table public.profiles
  add column if not exists anthropic_key_cipher text,  -- AES-256-GCM, see lib/crypto.ts
  add column if not exists anthropic_key_hint   text,  -- "sk-ant-…9f2a", safe to show
  add column if not exists anthropic_key_set_at timestamptz;

comment on column public.profiles.anthropic_key_cipher is
  'Encrypted with ENCRYPTION_KEY. Never sent to the browser.';
