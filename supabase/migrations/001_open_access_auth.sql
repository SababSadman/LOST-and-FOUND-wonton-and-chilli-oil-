-- Open-access auth for the UIU Lost & Found base project.
-- Safe to run against the already-pushed schema; it only replaces one function
-- and adds one policy. No tables, columns or data are touched.

-- 1. Honour the role chosen on the sign-in tab when the account is created.
--    Previously the role column fell back to its 'student' default, so an
--    admin sign-in could never provision an admin profile.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  inferred_name text;
  inferred_student_id text;
  inferred_role public.app_role;
begin
  inferred_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    'UIU Student'
  );
  inferred_student_id := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'student_id'), ''),
    nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
    new.id::text
  );
  inferred_role := case
    when lower(coalesce(new.raw_user_meta_data ->> 'role', '')) = 'admin' then 'admin'
    else 'student'
  end::public.app_role;

  insert into public.profiles (id, full_name, department, role)
  values (
    new.id,
    inferred_name,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'department'), ''), 'Not specified'),
    inferred_role
  );

  insert into public.profile_private (user_id, student_id, phone)
  values (
    new.id,
    inferred_student_id,
    nullif(trim(new.raw_user_meta_data ->> 'phone'), '')
  );

  return new;
end;
$$;

-- 2. Let a signed-in user insert their own profile rows.
--    The trigger normally creates them, but if it ever fails the client can
--    self-heal instead of leaving the account unusable.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profiles'
      and policyname = 'users can insert their profile'
  ) then
    create policy "users can insert their profile"
      on public.profiles for insert to authenticated
      with check (id = (select auth.uid()));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'profile_private'
      and policyname = 'users can insert their private profile'
  ) then
    create policy "users can insert their private profile"
      on public.profile_private for insert to authenticated
      with check (user_id = (select auth.uid()));
  end if;
end
$$;

-- Note: profiles already has "users can update their profile" with no column
-- restriction, so the portal can switch a role from the client. That is what
-- makes the Student/Admin tabs work for any account, and it is intentionally
-- permissive because this is a base/demo project.
