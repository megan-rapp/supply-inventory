create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_data (
  workspace_id uuid primary key references public.workspaces (id) on delete cascade,
  data jsonb not null,
  revision bigint not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_data enable row level security;

drop policy if exists "Members can read their workspace" on public.workspaces;
create policy "Members can read their workspace"
  on public.workspaces for select
  to authenticated
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspaces.id and m.user_id = (select auth.uid())
  ));

drop policy if exists "Users can read their own membership" on public.workspace_members;
create policy "Users can read their own membership"
  on public.workspace_members for select
  to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Members can read workspace data" on public.workspace_data;
create policy "Members can read workspace data"
  on public.workspace_data for select
  to authenticated
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspace_data.workspace_id and m.user_id = (select auth.uid())
  ));

drop policy if exists "Members can create workspace data" on public.workspace_data;
create policy "Members can create workspace data"
  on public.workspace_data for insert
  to authenticated
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_data.workspace_id and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "Members can update workspace data" on public.workspace_data;
create policy "Members can update workspace data"
  on public.workspace_data for update
  to authenticated
  using (exists (
    select 1 from public.workspace_members m
    where m.workspace_id = workspace_data.workspace_id and m.user_id = (select auth.uid())
  ))
  with check (
    updated_by = (select auth.uid())
    and exists (
      select 1 from public.workspace_members m
      where m.workspace_id = workspace_data.workspace_id and m.user_id = (select auth.uid())
    )
  );

create or replace function public.create_practice_workspace(workspace_name text)
returns table (workspace_id uuid, name text, invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_workspace public.workspaces;
begin
  if auth.uid() is null then
    raise exception 'Sign in before creating a workspace.';
  end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'Your account already belongs to a workspace.';
  end if;

  insert into public.workspaces (name, invite_code, created_by)
  values (
    trim(workspace_name),
    upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
    auth.uid()
  )
  returning * into new_workspace;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace.id, auth.uid(), 'owner');

  return query select new_workspace.id, new_workspace.name, new_workspace.invite_code;
end;
$$;

create or replace function public.join_practice_workspace(workspace_invite_code text)
returns table (workspace_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  matching_workspace_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a workspace.';
  end if;
  if exists (select 1 from public.workspace_members where user_id = auth.uid()) then
    raise exception 'Your account already belongs to a workspace.';
  end if;

  select id into matching_workspace_id
  from public.workspaces
  where invite_code = upper(trim(workspace_invite_code));

  if matching_workspace_id is null then
    raise exception 'That invite code is not valid.';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (matching_workspace_id, auth.uid(), 'member');

  return query select matching_workspace_id;
end;
$$;

revoke all on function public.create_practice_workspace(text) from public, anon;
revoke all on function public.join_practice_workspace(text) from public, anon;
grant execute on function public.create_practice_workspace(text) to authenticated;
grant execute on function public.join_practice_workspace(text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'workspace_data'
  ) then
    alter publication supabase_realtime add table public.workspace_data;
  end if;
end;
$$;
