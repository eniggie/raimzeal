-- Migration: harden handle_new_user security
-- Fixes Supabase linter issues:
--   1. function_search_path_mutable  — set search_path = '' in the function def
--   2. anon can execute handle_new_user  — revoke EXECUTE from anon
--   3. authenticated can execute handle_new_user  — revoke EXECUTE from authenticated
--
-- NOTE: profiles NOT NULL columns and their defaults:
--   name              NOT NULL  default ''
--   phone_verified    NOT NULL  default false
--   email_verified    NOT NULL  default false
--   subscription_status NOT NULL default 'none'
--   subscription_tier   NOT NULL default 'free'
--   created_at        NOT NULL  default now()
--   updated_at        NOT NULL  default now()
-- All omitted columns have safe server-side defaults — the INSERT below is safe.

-- 1. Harden the SECURITY DEFINER trigger function
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    now(),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- 2. Block REST RPC exposure — function is only meant to run from the trigger
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;

-- 3. Ensure the trigger still exists and is bound to auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
