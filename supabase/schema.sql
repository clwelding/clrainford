-- C. L. Rainford Welding & Fabrication database (clrainford.com).
-- Run once, top to bottom, in the Supabase SQL Editor of a fresh project.
--
-- Public marketing pages exist to bring work in the door; the real product
-- is the shop-floor Kanban at /shop (staff-only) and the plain-language
-- status view at /portal (client-only).
--
-- Core design, from the Cradle-to-Grave spec: two lanes, one hard gate.
-- Support Lane (office/materials/maintenance/QC) does everything that has
-- to happen before a torch gets lit; Skilled Lane (welders) only fabricates.
-- A job cannot enter the Skilled Lane (cutting/welding_assembly/finishing)
-- until every required material is staged AND every piece of equipment the
-- job needs is confirmed operational -- enforced below as a real trigger on
-- clrwf_jobs, not just a UI convention, exactly as the spec asks for.

-- ─────────────────────────────────────────────────────────────────────────
-- Email notifications
-- ─────────────────────────────────────────────────────────────────────────
-- An AFTER INSERT trigger on each public form table calls the
-- notify-submission Edge Function (supabase/functions/notify-submission),
-- which emails the shop through Resend. The function URL and the shared
-- webhook secret live in Supabase Vault, never in git -- create them once
-- in the SQL Editor (see supabase/README.md):
--   select vault.create_secret('https://<ref>.supabase.co/functions/v1/notify-submission', 'notify_submission_url');
--   select vault.create_secret('<random secret>', 'notify_submission_secret');
create extension if not exists pg_net with schema extensions;

create or replace function notify_submission_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_secret text;
begin
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'notify_submission_url';
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'notify_submission_secret';
  if v_url is null or v_secret is null then
    return new;
  end if;
  perform net.http_post(
    url := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body := jsonb_build_object('table', TG_TABLE_NAME, 'record', row_to_json(new))
  );
  return new;
end;
$$;

revoke execute on function notify_submission_webhook() from public, anon, authenticated;


create table if not exists clrwf_clients (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

-- Clients are found-or-created by email (see clrwf_quote_request_to_job
-- below) -- this has to be unique for "find" to mean anything.
create unique index if not exists clrwf_clients_email_uidx on clrwf_clients (lower(email));

create table if not exists clrwf_staff (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  name text not null,
  email text not null unique,
  role text not null check (role in ('admin', 'office', 'materials', 'maintenance', 'welder', 'qc')),
  -- Only meaningful for welders (see the WIP-limit trigger below), but
  -- harmless to default on every role rather than making it nullable.
  wip_limit int not null default 2,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clrwf_clients enable row level security;
alter table clrwf_staff enable row level security;

-- A client or staff member can read their own row (to see their own
-- profile after logging in); nobody selects another person's row directly
-- through these base tables.
create policy "clients can read their own row" on clrwf_clients
  for select to authenticated
  using (auth_user_id = auth.uid());

create policy "staff can read their own row" on clrwf_staff
  for select to authenticated
  using (auth_user_id = auth.uid());

create or replace function clrwf_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists clrwf_staff_touch on clrwf_staff;
create trigger clrwf_staff_touch
  before update on clrwf_staff
  for each row execute function clrwf_set_updated_at();

-- Staff-check helpers:
-- security definer, read-only, callable only by authenticated users, so RLS
-- policies elsewhere can reference them without every table needing its own
-- copy of the "is this caller an active staff member / admin" logic.
create or replace function clrwf_is_staff()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.clrwf_staff
    where auth_user_id = auth.uid() and active = true
  );
$$;

create or replace function clrwf_is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.clrwf_staff
    where auth_user_id = auth.uid() and active = true and role = 'admin'
  );
$$;

create or replace function clrwf_current_staff_id()
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select id from public.clrwf_staff where auth_user_id = auth.uid() and active = true;
$$;

revoke execute on function clrwf_is_staff() from public, anon;
revoke execute on function clrwf_is_admin() from public, anon;
revoke execute on function clrwf_current_staff_id() from public, anon;
grant execute on function clrwf_is_staff() to authenticated;
grant execute on function clrwf_is_admin() to authenticated;
grant execute on function clrwf_current_staff_id() to authenticated;

-- Staff need this to see whose job is whose on the Shop board (client name
-- embedded via clrwf_jobs' client_id FK) and to actually contact clients --
-- without it, PostgREST's embedded select silently returns nothing for the
-- join, since embedding still respects the joined table's own RLS.
create policy "staff can read all clients" on clrwf_clients
  for select to authenticated
  using (public.clrwf_is_staff());

-- Links a real Supabase Auth signup to a pre-created staff or client row by
-- email ("build the structure now, invite people later"). Handles both
-- tables in one trigger
-- since both can be pre-created by admin before the person ever logs in.
create or replace function clrwf_link_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clrwf_staff
    set auth_user_id = new.id
    where lower(email) = lower(new.email) and auth_user_id is null;
  update public.clrwf_clients
    set auth_user_id = new.id
    where lower(email) = lower(new.email) and auth_user_id is null;
  return new;
end;
$$;

drop trigger if exists clrwf_link_new_auth_user_trigger on auth.users;
create trigger clrwf_link_new_auth_user_trigger
  after insert on auth.users
  for each row execute function clrwf_link_new_auth_user();

-- On-demand fallback: if someone's auth.users row already existed before
-- their staff/client row was created, the INSERT trigger above never fires
-- for them. Call this at login time as a self-heal when the by-auth_user_id
-- lookup comes up empty.
create or replace function public.clrwf_link_my_auth_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clrwf_staff
    set auth_user_id = auth.uid()
    where lower(email) = lower(coalesce(auth.email(), '')) and auth_user_id is null;
  update public.clrwf_clients
    set auth_user_id = auth.uid()
    where lower(email) = lower(coalesce(auth.email(), '')) and auth_user_id is null;
end;
$$;

grant execute on function public.clrwf_link_my_auth_user() to authenticated;
revoke execute on function public.clrwf_link_my_auth_user() from public, anon;

-- Self-service quote requests from /quote. Write-only for anon, same
-- as every public form table in this file -- an applicant can never read
-- back other applicants' names/emails/photos. pit_configuration holds the
-- structured "Build Your Pit" component selections once that configurator
-- ships on /custom/jerk-pits; null for standard jobs or a plain
-- free-text custom request.
create table if not exists clrwf_quote_requests (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email text not null,
  phone text,
  category text not null check (category in ('residential', 'commercial', 'custom-jerk-pit', 'custom-other')),
  description text,
  pit_configuration jsonb,
  budget_range text,
  timeline text,
  photo_paths text[],
  created_at timestamptz not null default now()
);

alter table clrwf_quote_requests enable row level security;

create policy "Allow anon insert" on clrwf_quote_requests for insert to anon with check (true);
grant insert on clrwf_quote_requests to anon;

-- Staff need to see the request that generated a job (photos, budget,
-- timeline, raw description) -- the job row itself only carries what
-- clrwf_quote_request_to_job() below copies over.
create policy "staff can read quote requests" on clrwf_quote_requests
  for select to authenticated
  using (public.clrwf_is_staff());

-- Reuses the existing notify_submission_webhook() function (see the Email
-- notifications section above) -- emails staff via the notify-submission
-- Edge Function once it has a formatter for this table, same as every
-- other public form here.
drop trigger if exists clrwf_quote_requests_after_insert on clrwf_quote_requests;
create trigger clrwf_quote_requests_after_insert
  after insert on clrwf_quote_requests
  for each row execute function notify_submission_webhook();

create table if not exists clrwf_jobs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references clrwf_clients(id),
  quote_request_id uuid references clrwf_quote_requests(id),
  job_type text not null check (job_type in ('standard', 'custom')),
  category text not null check (category in ('residential', 'commercial', 'custom-jerk-pit', 'custom-other')),
  -- 13 resting stages. The spec's stage 7 ("READY TO FABRICATE gate") is
  -- not a place a job sits -- it's the enforcement point between
  -- equipment_readiness_check and cutting, implemented as a trigger below,
  -- not a stage value.
  stage text not null default 'intake' check (stage in (
    'intake', 'quoted', 'design_signoff', 'materials_sourcing', 'materials_staged',
    'equipment_readiness_check', 'cutting', 'welding_assembly', 'finishing',
    'quality_check', 'ready_for_pickup', 'delivered_invoiced', 'archived'
  )),
  priority text not null default 'standard' check (priority in ('rush', 'standard')),
  materials text,
  pit_configuration jsonb,
  photo_paths text[],
  assigned_to uuid references clrwf_staff(id),
  due_date date,
  -- Feeds /gallery and the landing page's rotating feature slot once
  -- a job is Delivered and staff mark it public -- see the Site Spec.
  public_gallery boolean not null default false,
  -- Explicit sign-off, not an inferred default: a job with zero materials-
  -- checklist rows or zero equipment requirements must NOT read as
  -- "nothing to check, therefore ready" (that vacuous-truth reading would
  -- let a job nobody bothered to check skip the gate entirely -- exactly
  -- the failure mode the gate exists to prevent). Set only by
  -- clrwf_confirm_materials_ready()/clrwf_confirm_equipment_ready() below,
  -- which re-verify the checklist/equipment tables themselves before
  -- allowing the confirmation, matching the spec's "not 'probably fine,'
  -- confirmed" language.
  materials_confirmed_by uuid references clrwf_staff(id),
  materials_confirmed_at timestamptz,
  equipment_confirmed_by uuid references clrwf_staff(id),
  equipment_confirmed_at timestamptz,
  -- Informational only, set by clrwf_enforce_gate_and_wip() the first time
  -- it allows Skilled-Lane entry -- NOT the enforcement mechanism itself.
  gate_cleared_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Which equipment a given job actually needs -- what
-- clrwf_job_gate_ready() below checks "all required equipment operational"
-- against. Without this join table "required equipment" has no definition.
create table if not exists clrwf_job_equipment_requirements (
  job_id uuid not null references clrwf_jobs(id) on delete cascade,
  equipment_id uuid not null,
  primary key (job_id, equipment_id)
);

create table if not exists clrwf_job_stage_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references clrwf_jobs(id) on delete cascade,
  stage text not null,
  entered_at timestamptz not null default now(),
  exited_at timestamptz
);

create table if not exists clrwf_materials_checklist (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references clrwf_jobs(id) on delete cascade,
  item text not null,
  status text not null default 'needed' check (status in ('needed', 'ordered', 'in_stock', 'staged')),
  staged_by uuid references clrwf_staff(id),
  staged_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists clrwf_equipment (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'operational' check (status in ('operational', 'scheduled_maintenance', 'down')),
  last_maintenance date,
  next_maintenance_due date,
  hours_since_service numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clrwf_job_equipment_requirements
  add constraint clrwf_job_equipment_requirements_equipment_fkey
  foreign key (equipment_id) references clrwf_equipment(id) on delete cascade;

create table if not exists clrwf_equipment_maintenance_log (
  id uuid primary key default gen_random_uuid(),
  equipment_id uuid not null references clrwf_equipment(id) on delete cascade,
  performed_by uuid references clrwf_staff(id),
  performed_at timestamptz not null default now(),
  notes text,
  next_due date
);

alter table clrwf_jobs enable row level security;
alter table clrwf_job_equipment_requirements enable row level security;
alter table clrwf_job_stage_history enable row level security;
alter table clrwf_materials_checklist enable row level security;
alter table clrwf_equipment enable row level security;
alter table clrwf_equipment_maintenance_log enable row level security;

-- The whole point of one shared board (per the Kanban spec: "standard and
-- custom work compete for the same welders and floor space") is that every
-- role sees the full floor, not just their own lane -- so read access is
-- any active staff member, full stop. Write access on clrwf_jobs is any
-- active staff member too; the two triggers below (gate + WIP) are what
-- actually enforce the hard rules, not row-level fencing by role, since the
-- spec doesn't ask for per-role column ownership beyond those two gates.
create policy "staff can read all jobs" on clrwf_jobs for select to authenticated using (public.clrwf_is_staff());
create policy "staff can update jobs" on clrwf_jobs for update to authenticated using (public.clrwf_is_staff());
create policy "staff can insert jobs" on clrwf_jobs for insert to authenticated with check (public.clrwf_is_staff());

create policy "staff can read job equipment requirements" on clrwf_job_equipment_requirements for select to authenticated using (public.clrwf_is_staff());
create policy "staff can manage job equipment requirements" on clrwf_job_equipment_requirements for all to authenticated using (public.clrwf_is_staff()) with check (public.clrwf_is_staff());

create policy "staff can read job stage history" on clrwf_job_stage_history for select to authenticated using (public.clrwf_is_staff());

create policy "staff can read materials checklist" on clrwf_materials_checklist for select to authenticated using (public.clrwf_is_staff());
create policy "staff can manage materials checklist" on clrwf_materials_checklist for all to authenticated using (public.clrwf_is_staff()) with check (public.clrwf_is_staff());

create policy "staff can read equipment" on clrwf_equipment for select to authenticated using (public.clrwf_is_staff());
create policy "staff can manage equipment" on clrwf_equipment for all to authenticated using (public.clrwf_is_staff()) with check (public.clrwf_is_staff());

create policy "staff can read equipment maintenance log" on clrwf_equipment_maintenance_log for select to authenticated using (public.clrwf_is_staff());
create policy "staff can insert equipment maintenance log" on clrwf_equipment_maintenance_log for insert to authenticated with check (public.clrwf_is_staff());

create index if not exists clrwf_jobs_stage_idx on clrwf_jobs (stage);
create index if not exists clrwf_jobs_assigned_to_idx on clrwf_jobs (assigned_to);
create index if not exists clrwf_job_stage_history_job_idx on clrwf_job_stage_history (job_id, entered_at desc);
create index if not exists clrwf_materials_checklist_job_idx on clrwf_materials_checklist (job_id);

drop trigger if exists clrwf_jobs_touch on clrwf_jobs;
create trigger clrwf_jobs_touch
  before update on clrwf_jobs
  for each row execute function clrwf_set_updated_at();

drop trigger if exists clrwf_equipment_touch on clrwf_equipment;
create trigger clrwf_equipment_touch
  before update on clrwf_equipment
  for each row execute function clrwf_set_updated_at();

-- Finds or creates the client by email, then drops the new job straight
-- into Intake -- this is what makes "/quote submission -> row auto-created
-- in Intake" (Site Spec) true without a staff approval step in between; a
-- quote request isn't a privileged grant,
-- it's just an inbound lead.
create or replace function clrwf_quote_request_to_job()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_client_id uuid;
begin
  insert into public.clrwf_clients (name, email)
    values (new.full_name, new.email)
    on conflict (lower(email)) do nothing;

  select id into v_client_id from public.clrwf_clients where lower(email) = lower(new.email);

  insert into public.clrwf_jobs (
    client_id, quote_request_id, job_type, category, stage,
    materials, pit_configuration, photo_paths
  ) values (
    v_client_id, new.id,
    case when new.category like 'custom%' then 'custom' else 'standard' end,
    new.category, 'intake',
    new.description, new.pit_configuration, new.photo_paths
  );

  return new;
end;
$$;

drop trigger if exists clrwf_quote_requests_to_job on clrwf_quote_requests;
create trigger clrwf_quote_requests_to_job
  after insert on clrwf_quote_requests
  for each row execute function clrwf_quote_request_to_job();

-- Keeps clrwf_job_stage_history accurate with zero client-side bookkeeping:
-- closes out the previous open row (if any) and opens a new one every time
-- a job is created or its stage actually changes. This is what lets a
-- later dashboard answer "where is time-to-completion actually being lost"
-- (Kanban spec, section 6) instead of guessing.
create or replace function clrwf_track_job_stage_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE' and new.stage is distinct from old.stage then
    update public.clrwf_job_stage_history
      set exited_at = now()
      where job_id = new.id and exited_at is null;
  end if;

  if TG_OP = 'INSERT' or new.stage is distinct from old.stage then
    insert into public.clrwf_job_stage_history (job_id, stage) values (new.id, new.stage);
  end if;

  return new;
end;
$$;

drop trigger if exists clrwf_jobs_track_stage_history on clrwf_jobs;
create trigger clrwf_jobs_track_stage_history
  after insert or update of stage on clrwf_jobs
  for each row execute function clrwf_track_job_stage_history();

-- Whether both halves of the gate have been explicitly confirmed -- the
-- actual definition of "the gate." Deliberately NOT inferred from checklist/
-- equipment emptiness (a job with zero checklist rows is not "nothing to
-- stage, therefore ready" -- it's "nobody has checked yet"). The two
-- confirm functions below are the only way these flags get set, and each
-- re-verifies the real checklist/equipment state before allowing it.
create or replace function clrwf_job_gate_ready(p_job_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select materials_confirmed_at is not null and equipment_confirmed_at is not null
  from public.clrwf_jobs where id = p_job_id;
$$;

revoke execute on function clrwf_job_gate_ready(uuid) from public, anon;
grant execute on function clrwf_job_gate_ready(uuid) to authenticated;

-- Materials/Prep staff call this once every checklist item for the job is
-- genuinely staged -- re-checked here, not just trusted, so a stale UI
-- can't confirm a job that quietly regressed. Raises rather than silently
-- no-ops if called too early, since a confirm button that fails silently
-- would be worse than no button at all.
create or replace function clrwf_confirm_materials_ready(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.clrwf_is_staff() then
    raise exception 'Only staff can confirm materials readiness.';
  end if;
  if exists (select 1 from public.clrwf_materials_checklist where job_id = p_job_id and status <> 'staged') then
    raise exception 'Job % still has materials that are not staged.', p_job_id;
  end if;
  update public.clrwf_jobs
    set materials_confirmed_by = public.clrwf_current_staff_id(), materials_confirmed_at = now()
    where id = p_job_id;
end;
$$;

-- Maintenance staff call this once every piece of equipment the job needs
-- is confirmed operational -- same re-check-don't-trust reasoning as above.
create or replace function clrwf_confirm_equipment_ready(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.clrwf_is_staff() then
    raise exception 'Only staff can confirm equipment readiness.';
  end if;
  if exists (
    select 1 from public.clrwf_job_equipment_requirements jer
    join public.clrwf_equipment e on e.id = jer.equipment_id
    where jer.job_id = p_job_id and e.status <> 'operational'
  ) then
    raise exception 'Job % still has required equipment that is not operational.', p_job_id;
  end if;
  update public.clrwf_jobs
    set equipment_confirmed_by = public.clrwf_current_staff_id(), equipment_confirmed_at = now()
    where id = p_job_id;
end;
$$;

revoke execute on function clrwf_confirm_materials_ready(uuid) from public, anon;
revoke execute on function clrwf_confirm_equipment_ready(uuid) from public, anon;
grant execute on function clrwf_confirm_materials_ready(uuid) to authenticated;
grant execute on function clrwf_confirm_equipment_ready(uuid) to authenticated;

-- Un-confirming: if the checklist or equipment status changes after
-- confirmation (e.g. a staged item gets bumped back to "ordered", or a
-- machine goes down), the stale confirmation must not silently survive --
-- otherwise the gate could still read "ready" against a checklist/equipment
-- state that's no longer true.
create or replace function clrwf_unconfirm_materials_on_checklist_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.clrwf_jobs
    set materials_confirmed_by = null, materials_confirmed_at = null
    where id = coalesce(new.job_id, old.job_id) and materials_confirmed_at is not null;
  return coalesce(new, old);
end;
$$;

drop trigger if exists clrwf_materials_checklist_unconfirm on clrwf_materials_checklist;
create trigger clrwf_materials_checklist_unconfirm
  after insert or update or delete on clrwf_materials_checklist
  for each row execute function clrwf_unconfirm_materials_on_checklist_change();

create or replace function clrwf_unconfirm_equipment_on_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'operational' then
    update public.clrwf_jobs j
      set equipment_confirmed_by = null, equipment_confirmed_at = null
      where equipment_confirmed_at is not null
        and exists (
          select 1 from public.clrwf_job_equipment_requirements jer
          where jer.job_id = j.id and jer.equipment_id = new.id
        );
  end if;
  return new;
end;
$$;

drop trigger if exists clrwf_equipment_unconfirm on clrwf_equipment;
create trigger clrwf_equipment_unconfirm
  after update of status on clrwf_equipment
  for each row execute function clrwf_unconfirm_equipment_on_status_change();

-- The hard gate (Kanban spec section 1/3: "not a suggestion, it's a hard
-- stage the board enforces") plus the WIP limit (section 7). Both are
-- enforced here, at the database layer, so
-- a client bug or a direct
-- Table Editor drag can't bypass either rule.
create or replace function clrwf_enforce_gate_and_wip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_skilled_stages text[] := array['cutting', 'welding_assembly', 'finishing'];
  v_in_progress_count int;
begin
  -- Gate: only checked on the one transition that matters -- entering the
  -- Skilled Lane from outside it. Bouncing backward (QC fail -> Finishing/
  -- Welding) or moving laterally within the Skilled Lane never re-checks
  -- the gate, since the job already cleared it once.
  if new.stage = any(v_skilled_stages) and not (old.stage = any(v_skilled_stages)) then
    if not public.clrwf_job_gate_ready(new.id) then
      raise exception 'Job % cannot enter the Skilled Lane: materials are not fully staged or required equipment is not operational.', new.id;
    end if;
    if new.gate_cleared_at is null then
      new.gate_cleared_at = now();
    end if;
  end if;

  -- WIP limit: only checked when a job is being placed into the Skilled
  -- Lane with an assignee -- protects a welder from self-inflicted
  -- context-switching across too many half-finished jobs at once.
  if new.stage = any(v_skilled_stages) and new.assigned_to is not null
     and not (old.stage = any(v_skilled_stages) and old.assigned_to = new.assigned_to) then
    select count(*) into v_in_progress_count
    from public.clrwf_jobs
    where assigned_to = new.assigned_to and stage = any(v_skilled_stages) and id <> new.id;

    if v_in_progress_count >= (select wip_limit from public.clrwf_staff where id = new.assigned_to) then
      raise exception 'Staff member % is already at their work-in-progress limit.', new.assigned_to;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists clrwf_jobs_guard_gate_and_wip on clrwf_jobs;
create trigger clrwf_jobs_guard_gate_and_wip
  before update of stage on clrwf_jobs
  for each row execute function clrwf_enforce_gate_and_wip();

-- Client-facing, plain-language status view for /portal. Filters to
-- the caller's own jobs via auth.uid() (safe regardless of view ownership,
-- since auth.uid() reads the querying role's own JWT) and exposes only
-- what a client should see -- no assigned welder, no internal materials
-- notes, no pricing. The five plain-language milestones map from these 13
-- internal stages entirely in the /portal frontend (Site Spec), not here.
create or replace view clrwf_jobs_portal as
select j.id, j.category, j.stage, j.priority, j.due_date, j.created_at, j.public_gallery
from clrwf_jobs j
join clrwf_clients c on c.id = j.client_id
where c.auth_user_id = auth.uid();

grant select on clrwf_jobs_portal to authenticated;

-- Public gallery feed for /gallery and the landing page's rotating
-- feature slot -- pre-filtered to delivered + explicitly-public jobs only,
-- same "narrow, already-filtered, definer-mode view" pattern as
-- game_submissions_public. Do not add security_invoker to this view; that
-- would break the filtering by re-applying clrwf_jobs' staff-only RLS to
-- anon callers.
create or replace view clrwf_gallery_public as
select id, category, photo_paths, created_at
from clrwf_jobs
where stage = 'delivered_invoiced' and public_gallery = true;

grant select on clrwf_gallery_public to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- CLRWF Storage buckets
-- ─────────────────────────────────────────────────────────────────────────
-- Two buckets, not one, because job photos can include the inside of a
-- client's home (security bars, railings) -- genuinely private -- while
-- gallery photos are meant to be shown off. Keeping them separate means
-- flipping a job to public_gallery can never accidentally expose a
-- different client's private intake photos just because the whole bucket
-- got made public.
insert into storage.buckets (id, name, public)
values ('clrwf-job-photos', 'clrwf-job-photos', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('clrwf-gallery-photos', 'clrwf-gallery-photos', true)
on conflict (id) do nothing;

-- Quote-form uploads: anon can attach photos when submitting a quote, but
-- can never list or read back anyone's uploads (no anon select policy) --
-- same reasoning as game_submissions' storage split.
create policy "Allow anon insert to clrwf-job-photos" on storage.objects
  for insert to anon
  with check (bucket_id = 'clrwf-job-photos');

create policy "Staff can read clrwf-job-photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'clrwf-job-photos' and public.clrwf_is_staff());

-- Gallery bucket only ever receives what staff explicitly choose to
-- publish (curated in the /shop UI, copied across from clrwf-job-photos) --
-- anon never writes to it, only reads.
create policy "Staff can insert clrwf-gallery-photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'clrwf-gallery-photos' and public.clrwf_is_staff());

create policy "Public can read clrwf-gallery-photos" on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'clrwf-gallery-photos');

-- Commercial maintenance agreement inquiries -- deliberately a separate
-- table from clrwf_quote_requests (Site Spec: "distinct from one-off
-- quotes, since recurring commercial revenue is the growth lever"), so
-- these leads are trackable/reportable on their own rather than mixed into
-- the general intake funnel. Write-only for anon, same convention as every
-- other public form here; not wired into clrwf_jobs since a maintenance
-- agreement is a contract to negotiate, not a fabrication job to schedule.
create table if not exists clrwf_maintenance_agreement_requests (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  contact_name text,
  email text not null,
  phone text,
  property_description text,
  service_needs text,
  message text,
  created_at timestamptz not null default now()
);

alter table clrwf_maintenance_agreement_requests enable row level security;

create policy "Allow anon insert" on clrwf_maintenance_agreement_requests for insert to anon with check (true);
grant insert on clrwf_maintenance_agreement_requests to anon;

create policy "staff can read maintenance agreement requests" on clrwf_maintenance_agreement_requests
  for select to authenticated
  using (public.clrwf_is_staff());

drop trigger if exists clrwf_maintenance_agreement_requests_after_insert on clrwf_maintenance_agreement_requests;
create trigger clrwf_maintenance_agreement_requests_after_insert
  after insert on clrwf_maintenance_agreement_requests
  for each row execute function notify_submission_webhook();

-- General contact messages from /contact.html -- deliberately
-- separate from clrwf_quote_requests:
-- a general "reach us" message isn't a job lead and shouldn't feed the
-- Kanban intake trigger.
create table if not exists clrwf_contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  created_at timestamptz not null default now()
);

alter table clrwf_contact_messages enable row level security;

create policy "Allow anon insert" on clrwf_contact_messages for insert to anon with check (true);
grant insert on clrwf_contact_messages to anon;

create policy "staff can read contact messages" on clrwf_contact_messages
  for select to authenticated
  using (public.clrwf_is_staff());

drop trigger if exists clrwf_contact_messages_after_insert on clrwf_contact_messages;
create trigger clrwf_contact_messages_after_insert
  after insert on clrwf_contact_messages
  for each row execute function notify_submission_webhook();

-- Lets /portal.html tell "no job on file for that email" from
-- "we have you, check your inbox" BEFORE sending a magic link.
-- A clrwf_clients
-- row is created automatically the moment someone submits their first
-- quote request (see clrwf_quote_request_to_job), so any past requester
-- can log into the portal with no separate signup step.
create or replace function public.clrwf_email_has_client(p_email text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists(
    select 1 from public.clrwf_clients
    where lower(email) = lower(p_email)
  );
$$;

grant execute on function public.clrwf_email_has_client(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────────────────
-- CLRWF Capabilities catalog (searchable "do you do X?" reference data)
-- ─────────────────────────────────────────────────────────────────────────
-- Pure public reference content -- no RLS-worthy sensitivity, so unlike
-- every other clrwf_* table above this one is a plain anon-readable table,
-- not a write-only form or a staff-gated one. keywords holds realistic
-- customer problem-phrasing ("rusted fire escape", "cattle gate") rather
-- than repeating the item name, so a natural-language search actually
-- finds the right capability instead of requiring the customer to already
-- know the shop's own category vocabulary.
create table if not exists clrwf_capabilities (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  category_order int not null,
  item_order int not null,
  name text not null,
  slug text not null,
  description text not null,
  prototype_note text,
  keywords text[] not null default '{}',
  created_at timestamptz not null default now(),
  unique (slug)
);

-- Not a GENERATED column: array_to_string() is classified STABLE (not
-- IMMUTABLE) on this Postgres build, which a generated column's expression
-- must be. Maintained by a trigger instead -- the standard workaround, and
-- arguably the more common pattern for tsvector maintenance regardless.
alter table clrwf_capabilities add column if not exists search_vector tsvector;

create or replace function clrwf_capabilities_update_search_vector()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.search_vector :=
    setweight(to_tsvector('english'::regconfig, coalesce(new.name, '')), 'A') ||
    setweight(to_tsvector('english'::regconfig, array_to_string(coalesce(new.keywords, '{}'), ' ')), 'A') ||
    setweight(to_tsvector('english'::regconfig, coalesce(new.description, '')), 'B') ||
    setweight(to_tsvector('english'::regconfig, coalesce(new.category, '')), 'C');
  return new;
end;
$$;

drop trigger if exists clrwf_capabilities_search_vector_trigger on clrwf_capabilities;
create trigger clrwf_capabilities_search_vector_trigger
  before insert or update on clrwf_capabilities
  for each row execute function clrwf_capabilities_update_search_vector();

create index if not exists clrwf_capabilities_search_idx on clrwf_capabilities using gin(search_vector);
create index if not exists clrwf_capabilities_category_idx on clrwf_capabilities (category_order, item_order);

alter table clrwf_capabilities enable row level security;

create policy "Allow public read" on clrwf_capabilities for select to anon, authenticated using (true);
grant select on clrwf_capabilities to anon, authenticated;

-- Staff-only write access -- this is curated catalog content, not a public
-- form; edits happen via the Table Editor or a future admin tool, not from
-- the public site.
create policy "staff can manage capabilities" on clrwf_capabilities
  for all to authenticated
  using (public.clrwf_is_staff())
  with check (public.clrwf_is_staff());

-- Ranked full-text search when q is given; falls back to the catalog's own
-- category/item order for a plain browse-everything call (q null/blank) --
-- one function serves both the search box and the default "browse all"
-- view on /capabilities.html, rather than needing two code paths.
--
-- Tiered, not flat OR: a customer sentence ("my porch handle broke") often
-- has only one word that happens to appear anywhere in the catalog at all
-- (e.g. "handle" inside an unrelated row's description) -- a flat OR search
-- (the original design here) surfaces that single incidental word-match as
-- the #1 "Best Match" with total confidence, which is actively misleading,
-- not just unhelpful (caught via real testing: "my porch handle broke" ->
-- top hit "Livestock gates, panels, chutes, headgates", matched only on the
-- stemmed word "handling" inside its description). Fix: try AND first (every
-- significant word matching the SAME row -- a genuinely strong signal) and
-- only fall back to the OR-relaxed search when AND finds nothing, matching
-- how real search engines relax progressively rather than jumping straight
-- to "any single word, anywhere" and calling it a confident answer.
-- match_tier tells the caller which happened: 1 = strong (AND) match,
-- 2 = weak (OR fallback) match, 0 = no query / browse-all. The UI uses this
-- to withhold the "Best Match" star and keep the "Ask Us Directly" CTA
-- visible whenever every result came from the weak tier.
create or replace function clrwf_search_capabilities(q text default null)
returns table (
  id uuid, category text, category_order int, item_order int, name text, slug text,
  description text, prototype_note text, keywords text[], created_at timestamptz,
  search_vector tsvector, match_tier int
)
language sql
stable
security definer
set search_path = ''
as $$
  with parsed as (
    select
      plainto_tsquery('english'::regconfig, q) as and_query,
      nullif(replace(plainto_tsquery('english'::regconfig, q)::text, ' & ', ' | '), '') as or_query_text
  ),
  blank as (
    select (q is null or btrim(q) = '' or parsed.and_query::text = '') as is_blank
    from parsed
  ),
  and_hits as (
    select c.*, 1 as match_tier, ts_rank(c.search_vector, parsed.and_query) as rnk
    from public.clrwf_capabilities c, parsed, blank
    where not blank.is_blank
      and c.search_vector @@ parsed.and_query
  ),
  or_hits as (
    select c.*, 2 as match_tier, ts_rank(c.search_vector, to_tsquery('english'::regconfig, parsed.or_query_text)) as rnk
    from public.clrwf_capabilities c, parsed, blank
    where not blank.is_blank
      and parsed.or_query_text is not null
      and c.search_vector @@ to_tsquery('english'::regconfig, parsed.or_query_text)
      and not exists (select 1 from and_hits)
  ),
  browse_all as (
    select c.*, 0 as match_tier, 0::real as rnk
    from public.clrwf_capabilities c, blank
    where blank.is_blank
  )
  select id, category, category_order, item_order, name, slug, description, prototype_note, keywords, created_at, search_vector, match_tier
  from (
    select * from and_hits
    union all
    select * from or_hits
    union all
    select * from browse_all
  ) combined
  order by match_tier, rnk desc, category_order, item_order;
$$;

grant execute on function clrwf_search_capabilities(text) to anon, authenticated;

-- ── 1. Structural & Architectural ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Structural & Architectural', 1, 1, 'Structural steel framing (beams, columns, mezzanines)', 'structural-steel-framing',
 'Load-bearing steel frameworks for additions, mezzanine levels inside warehouses/lofts, or reinforcing an existing building. Typically I-beams, W-beams, or HSS columns, welded or bolted per AWS D1.1 structural code.',
 'A steel mezzanine platform with columns and cross-bracing inside a warehouse.',
 '{mezzanine,warehouse addition,steel beams,i-beam,building addition,loft mezzanine,column bracing,AWS D1.1,load bearing steel}'),
('Structural & Architectural', 1, 2, 'Fire escape fabrication & repair', 'fire-escape-repair',
 'Exterior emergency egress stairs bolted or welded to masonry buildings — ladders, landings, and stair runs in steel angle and plate. Chicago has a large stock of older 2-4 flat buildings with fire escapes subject to city inspection ordinances, so repair/recertification work is steady.',
 'A classic zig-zag exterior fire escape on a brick two-flat, painted black.',
 '{fire escape repair,rusted fire escape,egress stairs,emergency stairs,fire escape inspection,city ordinance,two-flat fire escape,exterior stairs,fire escape recertification}'),
('Structural & Architectural', 1, 3, 'Stairs, spiral stairs, railings, handrails', 'stairs-railings-handrails',
 'Interior or exterior stairs, from straight-run industrial stairs to curved spiral units, plus code-compliant handrails (34-38" height, baluster spacing under 4").',
 'A steel spiral staircase with pipe railing and open metal treads.',
 '{spiral staircase,interior stairs,handrail,baluster,stair railing,metal stairs,industrial stairs,code compliant railing}'),
('Structural & Architectural', 1, 4, 'Balconies, catwalks, platforms', 'balconies-catwalks-platforms',
 'Elevated walking/standing surfaces — apartment balconies, industrial catwalks connecting equipment, inspection platforms. Chicago''s balcony ordinance has pushed a lot of replacement/reinforcement work.',
 'A cantilevered steel-framed apartment balcony with a simple picket railing.',
 '{apartment balcony,balcony repair,balcony ordinance,catwalk,inspection platform,elevated platform,balcony replacement,balcony reinforcement}'),
('Structural & Architectural', 1, 5, 'Custom gates (driveway, pedestrian, security)', 'custom-gates',
 'Swing or slide gates for driveways, alley entries, or pedestrian walk-throughs, in plain steel, ornamental iron, or aluminum.',
 'A black double-swing driveway gate with simple vertical pickets and a center latch.',
 '{driveway gate,swing gate,slide gate,security gate,alley gate,pedestrian gate,iron gate,gate repair}'),
('Structural & Architectural', 1, 6, 'Wrought-iron fencing', 'wrought-iron-fencing',
 'Ornamental fence panels and posts, often matching Chicago''s classic greystone/two-flat aesthetic — pickets, finials, scrollwork.',
 'A low black iron picket fence in front of a Chicago greystone, with decorative finial tops.',
 '{iron fence,greystone fence,picket fence,ornamental fence,fence repair,decorative fencing,scrollwork fence}'),
('Structural & Architectural', 1, 7, 'Awnings, canopies, carports', 'awnings-canopies-carports',
 'Freestanding or wall-mounted steel-framed shade structures, from a simple entry canopy to a full carport.',
 'A flat steel-framed carport with a single support row, open sides.',
 '{carport,entry canopy,steel awning,car shelter,shade structure}'),
('Structural & Architectural', 1, 8, 'Architectural facades / decorative panels', 'architectural-facades-panels',
 'Custom metal cladding or screen panels for building exteriors — often laser or plasma-cut patterns for a modern look.',
 'A perforated/cut steel screen panel mounted as a building facade accent.',
 '{facade panel,metal cladding,screen panel,perforated panel,building accent,laser cut facade}'),
('Structural & Architectural', 1, 9, 'Structural repair (sistering beams, reinforcing)', 'structural-repair-sistering',
 'Reinforcing an existing weakened or damaged structural member by welding a new piece alongside it ("sistering"), or adding bracing/plates to restore load capacity.',
 'A steel I-beam with a welded reinforcing plate/sister beam alongside it in a basement or warehouse ceiling.',
 '{sistering beam,sagging beam,cracked beam,basement beam repair,reinforce joist,structural crack,weak beam}'),
('Structural & Architectural', 1, 10, 'Rooftop deck & pergola structural supports', 'rooftop-deck-pergola-supports',
 'Steel sub-framing that supports rooftop decks, pergolas, or green roof structures — critical in Chicago''s dense multi-unit buildings where rooftop amenity space is common.',
 'A steel support frame under a wood-decked rooftop patio, with a pergola frame above.',
 '{rooftop deck,roof deck support,pergola frame,green roof structure,rooftop patio,rooftop amenity space}');

-- ── 2. Agricultural & Ranch ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Agricultural & Ranch', 2, 1, 'Livestock gates, panels, chutes, headgates', 'livestock-gates-chutes',
 'Heavy-duty tube-steel gates and panels for moving/containing cattle or other livestock, including squeeze chutes and headgates for handling.',
 'A galvanized tube-steel cattle gate, 12-16 ft, with a slide latch.',
 '{cattle gate,squeeze chute,headgate,livestock panel,farm gate,tube gate}'),
('Agricultural & Ranch', 2, 2, 'Hay feeders, bale spears, feed bunks', 'hay-feeders-bale-spears',
 'Feeding equipment — round bale feeders (ring style), bale spears that mount to tractor/skid-steer, and long feed bunks/troughs.',
 'A round tube-steel hay feeder ring for round bales.',
 '{round bale feeder,bale spear,feed bunk,hay ring,cattle feeder}'),
('Agricultural & Ranch', 2, 3, 'Equipment attachments (grapples, forks, buckets)', 'ag-equipment-attachments',
 'Custom or repaired attachments for tractors, skid steers, and loaders — grapple buckets, pallet forks, brush grapples.',
 'A skid-steer grapple bucket attachment.',
 '{skid steer grapple,pallet forks,bucket attachment,loader attachment,brush grapple,tractor attachment}'),
('Agricultural & Ranch', 2, 4, 'Corral and pen systems', 'corral-pen-systems',
 'Modular pen/corral panel systems for sorting and holding livestock.',
 'A modular pipe corral panel, freestanding, connected in a ring.',
 '{corral panel,livestock pen,sorting pen,pipe corral}'),
('Agricultural & Ranch', 2, 5, 'Equipment repair (implements, hitches, PTO shafts)', 'farm-implement-repair',
 'General repair welding on farm implements — broken hitches, cracked frames, worn PTO shaft guards.',
 'A cracked disc-harrow frame being repaired with a welded patch/gusset.',
 '{broken hitch,cracked frame,PTO shaft,implement repair,disc harrow repair,farm equipment welding}'),
('Agricultural & Ranch', 2, 6, 'Custom trailers (livestock, flatbed, utility)', 'ag-livestock-trailers',
 'The ag-specific application of custom trailer builds — stock trailers with slatted sides, etc. (see Trailers & Towing for the general trailer build process).',
 'A gooseneck livestock trailer with slatted steel sides.',
 '{stock trailer,gooseneck trailer,livestock hauler,slatted trailer}');

-- ── 3. Trailers & Towing ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Trailers & Towing', 3, 1, 'Utility trailers', 'utility-trailers',
 'Small open trailers for hauling equipment, lawn gear, or general cargo — steel frame, wood or steel deck, single or tandem axle.',
 'A 5x8 single-axle open utility trailer with mesh sides.',
 '{small trailer,lawn equipment trailer,cargo trailer,mesh trailer,open trailer}'),
('Trailers & Towing', 3, 2, 'Flatbed / equipment trailers', 'flatbed-equipment-trailers',
 'Larger flat-deck trailers rated for hauling heavy equipment (skid steers, tractors, vehicles), typically tandem or triple axle.',
 'A 20 ft tandem-axle flatbed equipment trailer with ramps.',
 '{equipment hauler,skid steer trailer,tandem axle trailer,flat deck trailer}'),
('Trailers & Towing', 3, 3, 'Enclosed cargo trailers', 'enclosed-cargo-trailers',
 'Fully enclosed box trailers for hauling tools, goods, or serving as mobile workshops.',
 'A 6x12 enclosed V-nose cargo trailer, single axle.',
 '{cargo trailer,mobile workshop,v-nose trailer,box trailer}'),
('Trailers & Towing', 3, 4, 'Car haulers', 'car-haulers',
 'Trailers specifically built/reinforced for hauling one or more vehicles, often with tie-down rails and a beavertail ramp.',
 'A tandem-axle car hauler with a beavertail and stake pockets.',
 '{vehicle trailer,beavertail trailer,car trailer,tow trailer}'),
('Trailers & Towing', 3, 5, 'Custom hitches, receivers, tow bars', 'custom-hitches-receivers',
 'Fabricated or repaired hitch components — receiver hitches for trucks, custom tow bars, pintle hitch mounts.',
 'A rear receiver hitch welded to a truck frame.',
 '{receiver hitch,tow bar,pintle hitch,truck hitch install}'),
('Trailers & Towing', 3, 6, 'Trailer repair & axle replacement', 'trailer-repair-axle',
 'General trailer maintenance welding — frame cracks, axle swaps, deck replacement.',
 'A trailer frame with a cracked cross-member being repaired.',
 '{trailer axle,cracked trailer frame,trailer deck replacement,trailer maintenance,trailer axle swap}'),
('Trailers & Towing', 3, 7, 'Ramps and loading equipment', 'ramps-loading-equipment',
 'Loading ramps for trailers or docks, fixed or fold-up, plate or expanded-metal deck.',
 'A fold-up steel loading ramp pair for a flatbed trailer.',
 '{loading ramp,dock ramp,fold up ramp,trailer ramp}');

-- ── 4. Automotive & Performance ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Automotive & Performance', 4, 1, 'Roll cages', 'roll-cages',
 'Tube-steel safety cages welded into a vehicle''s interior for racing or off-road use, built to sanctioning body spec (NHRA, SCCA, etc. where applicable).',
 'A DOM tube roll cage inside a stripped race car interior.',
 '{race car cage,safety cage,tube cage,NHRA cage,SCCA cage,roll cage install}'),
('Automotive & Performance', 4, 2, 'Custom exhaust systems / headers', 'custom-exhaust-headers',
 'Fabricated exhaust piping and headers, mandrel-bent tube welded to fit specific engine/chassis combos.',
 'A stainless mandrel-bent exhaust system under a car.',
 '{header fabrication,exhaust piping,mandrel bend,custom exhaust}'),
('Automotive & Performance', 4, 3, 'Chassis fabrication & modification', 'chassis-fabrication',
 'Building or modifying a vehicle''s chassis/frame — stretching, narrowing, reinforcing, or full custom builds.',
 'A tube-frame chassis for a custom or race vehicle, bare metal.',
 '{custom chassis,frame stretch,frame narrow,race car frame}'),
('Automotive & Performance', 4, 4, 'Suspension components (control arms, brackets)', 'suspension-components',
 'Fabricated suspension parts — control arms, subframe connectors, mounting brackets.',
 'A tubular steel control arm with rod-end joints.',
 '{control arm,subframe connector,suspension bracket,tubular control arm}'),
('Automotive & Performance', 4, 5, 'Frame repair / rust repair', 'frame-rust-repair',
 'Cutting out rusted or damaged frame/body sections and welding in new steel.',
 'A truck frame section with a rusted-out area cut and patched with new steel plate.',
 '{rusted frame,truck frame repair,rust hole,frame patch,rusted out truck}'),
('Automotive & Performance', 4, 6, 'Custom bumpers, brush guards, skid plates', 'custom-bumpers-brush-guards',
 'Heavy-duty steel bumpers and underbody protection for trucks/off-road vehicles.',
 'A tube-steel front bumper with integrated brush guard on a pickup truck.',
 '{truck bumper,brush guard,skid plate,off-road bumper}'),
('Automotive & Performance', 4, 7, 'Off-road racing components', 'off-road-racing-components',
 'Specialized fabrication for off-road race trucks/buggies — trophy truck arms, chassis reinforcement, skid systems.',
 'A tube-chassis off-road race truck under construction.',
 '{trophy truck,off-road buggy,race truck arms,chassis reinforcement}');

-- ── 5. Industrial & Manufacturing Support ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Industrial & Manufacturing Support', 5, 1, 'Custom jigs & fixtures', 'custom-jigs-fixtures',
 'Precision welding/assembly fixtures that hold parts in place for a repeatable manufacturing process.',
 'A steel welding jig/fixture table holding a part in position with toggle clamps.',
 '{welding fixture,assembly jig,production fixture,toggle clamp table}'),
('Industrial & Manufacturing Support', 5, 2, 'Machine guards & safety enclosures', 'machine-guards-enclosures',
 'OSHA-compliant guarding around moving machinery — wire mesh panels, framed enclosures, interlocked doors.',
 'A wire-mesh panel machine guard enclosure around an industrial machine.',
 '{OSHA guard,machine enclosure,wire mesh guard,safety fencing,machine safety}'),
('Industrial & Manufacturing Support', 5, 3, 'Conveyor frames & supports', 'conveyor-frames-supports',
 'Structural steel framing that supports conveyor belts/rollers in a production or warehouse line.',
 'A steel conveyor support frame with roller mounts.',
 '{conveyor frame,roller support,conveyor line}'),
('Industrial & Manufacturing Support', 5, 4, 'Equipment stands, racks, carts', 'equipment-stands-racks-carts',
 'Custom stands for holding equipment at working height, storage racks, or mobile shop carts.',
 'A steel equipment stand/cart with casters and a tool tray.',
 '{shop cart,tool stand,storage rack,mobile cart,equipment stand}'),
('Industrial & Manufacturing Support', 5, 5, 'Tanks, hoppers, chutes (non-pressure)', 'tanks-hoppers-chutes',
 'Non-pressure-rated containers for holding or directing bulk material — hoppers, chutes, mixing tanks.',
 'A sheet-steel hopper with a conical bottom and outlet chute.',
 '{hopper,mixing tank,bulk material chute,sheet metal tank}'),
('Industrial & Manufacturing Support', 5, 6, 'Custom brackets & mounts', 'custom-brackets-mounts',
 'General-purpose fabricated brackets for mounting equipment, piping, or machinery.',
 'An L-shaped steel mounting bracket bolted to a wall.',
 '{mounting bracket,equipment mount,pipe bracket,wall bracket}'),
('Industrial & Manufacturing Support', 5, 7, 'Production line repair/retrofit', 'production-line-repair',
 'On-site welding repair or modification of existing production line equipment to extend life or add capability.',
 'A technician welding a repair on an in-place conveyor/production line component.',
 '{line repair,retrofit,on-site welding,production downtime}');

-- ── 6. Oilfield / Energy / Mining ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Oilfield / Energy / Mining', 6, 1, 'Wellhead structures & supports', 'wellhead-structures-supports',
 'Structural steel supports and platforms around wellhead equipment.',
 'A steel support platform around a wellhead assembly.',
 '{wellhead platform,wellhead support}'),
('Oilfield / Energy / Mining', 6, 2, 'Pipe racks & skids', 'pipe-racks-skids',
 'Elevated steel racks that carry piping runs across a facility, or skid-mounted equipment bases.',
 'An elevated steel pipe rack carrying multiple parallel pipe runs.',
 '{pipe rack,equipment skid base,skid mounted}'),
('Oilfield / Energy / Mining', 6, 3, 'Equipment skids', 'equipment-skids',
 'Steel base frames that equipment (pumps, generators, compressors) is mounted to for portability.',
 'A steel skid base with a pump/generator mounted on top.',
 '{pump skid,generator skid,compressor skid}'),
('Oilfield / Energy / Mining', 6, 4, 'Tank batteries (structural work)', 'tank-batteries-structural',
 'Structural steel work supporting tank battery installations (walkways, stairs, containment structure) — not the pressure tanks themselves unless separately certified.',
 'A steel stair/walkway structure connecting a row of storage tanks.',
 '{tank battery walkway,tank stairs,containment structure}'),
('Oilfield / Energy / Mining', 6, 5, 'Mining equipment repair & fabrication', 'mining-equipment-repair',
 'Heavy repair welding on mining equipment — buckets, frames, wear plates.',
 'A large excavator bucket with wear-plate reinforcement welds.',
 '{excavator bucket repair,wear plate,mining fabrication}'),
('Oilfield / Energy / Mining', 6, 6, 'Heavy equipment attachments', 'heavy-equipment-attachments',
 'Custom attachments for excavators, loaders, and other heavy equipment.',
 'A custom excavator thumb attachment.',
 '{excavator thumb,loader attachment,heavy equipment custom}');

-- ── 6a. Municipal, Transit & Rail (Chicago-specific) ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Municipal, Transit & Rail', 7, 1, 'CTA/Metra-adjacent contract fabrication', 'transit-contract-fabrication',
 'Fabrication work performed as a subcontractor on transit projects — platform components, fencing, structural brackets — typically won through bid processes with prime contractors.',
 'A steel platform edge railing section matching CTA station standards.',
 '{CTA fabrication,Metra contract,transit platform,subcontractor fabrication}'),
('Municipal, Transit & Rail', 7, 2, 'Streetscape furniture', 'streetscape-furniture',
 'City/ward beautification hardware — bike racks, planters, bollards — often procured through municipal or aldermanic contracts.',
 'A steel loop-style bike rack, the type common on Chicago sidewalks.',
 '{bike rack,planter,bollard,aldermanic contract,city beautification}'),
('Municipal, Transit & Rail', 7, 3, 'Loop/downtown scaffolding and shoring components', 'scaffolding-shoring-components',
 'Structural components supporting temporary scaffolding or shoring systems for downtown construction/maintenance.',
 'A steel shoring frame section used in a sidewalk/building scaffold system.',
 '{shoring frame,scaffold component,downtown construction}'),
('Municipal, Transit & Rail', 7, 4, 'Snow/ice fleet attachments', 'snow-ice-fleet-attachments',
 'Plow mounts, salt spreader frames, and other winter fleet attachments for city or private fleet vehicles.',
 'A steel plow mount frame on the front of a city truck.',
 '{plow mount,salt spreader frame,winter fleet}'),
('Municipal, Transit & Rail', 7, 5, 'Public works equipment repair', 'public-works-equipment-repair',
 'General repair welding for public works department equipment — plows, mowers, loaders.',
 'A public works truck with a repaired plow frame.',
 '{plow repair,mower repair,city fleet repair}');

-- ── 7. Marine & Dock ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Marine & Dock', 8, 1, 'Boat trailers', 'boat-trailers',
 'Trailers built specifically to cradle and launch boats, with bunks or rollers, often galvanized for water exposure.',
 'A tandem-axle galvanized boat trailer with roller supports.',
 '{galvanized trailer,boat launch trailer,roller trailer}'),
('Marine & Dock', 8, 2, 'Dock frameworks, ladders, cleats', 'dock-frameworks-ladders-cleats',
 'Structural steel or aluminum framing for docks, plus ladders and cleats for tie-off.',
 'An aluminum dock frame section with an integrated ladder.',
 '{dock frame,dock ladder,cleat,aluminum dock}'),
('Marine & Dock', 8, 3, 'Boat lifts (structural components)', 'boat-lift-structural',
 'Structural steel framing for boat lift systems (the lift mechanism itself is often a purchased component; the frame/mounting is fabricated).',
 'A steel boat lift frame at a dock, boat suspended above water.',
 '{boat lift frame,dock lift mount}'),
('Marine & Dock', 8, 4, 'Marine railings & hardware', 'marine-railings-hardware',
 'Corrosion-resistant railings and hardware for boats or dockside structures, often stainless or aluminum.',
 'A stainless tube railing along a boat deck edge.',
 '{stainless railing,boat deck railing,dock railing}'),
('Marine & Dock', 8, 5, 'Prop guards, brackets', 'prop-guards-brackets',
 'Protective guards around boat propellers, or mounting brackets for marine equipment.',
 'A steel prop guard cage around an outboard motor.',
 '{propeller guard,outboard motor guard,marine bracket}');

-- ── 8. Furniture & Home ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Furniture & Home', 9, 1, 'Custom tables (dining, coffee, console)', 'custom-tables',
 'Steel-base or steel/wood-combo tables — a very popular category for showing off clean weld work and design sense.',
 'A steel-framed dining table with a live-edge wood top.',
 '{steel base table,dining table,coffee table,live edge table,console table}'),
('Furniture & Home', 9, 2, 'Bed frames', 'bed-frames',
 'Custom steel bed frames, from minimalist platform frames to industrial four-poster styles.',
 'A black steel platform bed frame with a simple headboard.',
 '{steel bed frame,platform bed,industrial bed}'),
('Furniture & Home', 9, 3, 'Shelving units', 'shelving-units',
 'Freestanding or wall-mounted steel shelving, often paired with wood shelves for a modern industrial look.',
 'A steel-framed shelving unit with wood plank shelves.',
 '{steel shelving,industrial shelf,wall shelving}'),
('Furniture & Home', 9, 4, 'Fire pits & fireplace screens', 'fire-pits-fireplace-screens',
 'Steel fire pits (bowl or box style) for patios, plus decorative fireplace screens for indoor fireplaces.',
 'A round steel bowl fire pit with a laser-cut decorative band.',
 '{patio fire pit,fire bowl,fireplace screen,laser cut fire pit}'),
('Furniture & Home', 9, 5, 'Wine racks', 'wine-racks',
 'Custom steel wine storage racks/frames, freestanding or built-in.',
 'A steel modular wine rack holding bottles at an angle.',
 '{wine storage,steel wine rack,built-in wine rack}'),
('Furniture & Home', 9, 6, 'Bar stools & seating frames', 'bar-stools-seating-frames',
 'Steel-framed stools and chairs, often paired with wood or upholstered seats.',
 'A steel-legged bar stool with a wood seat.',
 '{steel bar stool,chair frame,seating frame}'),
('Furniture & Home', 9, 7, 'Kitchen islands / commercial kitchen equipment frames', 'kitchen-islands-commercial-equipment',
 'Custom kitchen island frames (residential) or stainless equipment stands/tables (commercial kitchens).',
 'A stainless steel commercial kitchen prep table on wheels.',
 '{kitchen island frame,stainless prep table,commercial kitchen stand}');

-- ── 9. Outdoor Living & Recreation ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Outdoor Living & Recreation', 10, 1, 'Pergolas & patio structures', 'pergolas-patio-structures',
 'Freestanding steel-framed pergolas or patio cover structures.',
 'A black steel pergola frame over a backyard patio.',
 '{backyard pergola,patio cover,steel pergola}'),
('Outdoor Living & Recreation', 10, 2, 'BBQ grills & smokers (custom)', 'custom-bbq-grills-smokers',
 'Custom-built grills and offset smokers, often made from steel pipe or plate.',
 'An offset steel smoker with a firebox and rolling cart.',
 '{offset smoker,custom grill,bbq pit,smoker cart,jerk pan,jerk drum}'),
('Outdoor Living & Recreation', 10, 3, 'Playground equipment', 'playground-equipment',
 'Steel-framed playground structures — climbing frames, swing sets, slides support structures.',
 'A steel-framed swing set with a climbing structure attached.',
 '{swing set,climbing frame,slide structure}'),
('Outdoor Living & Recreation', 10, 4, 'Outdoor exercise/gym equipment', 'outdoor-exercise-gym-equipment',
 'Steel fitness equipment for outdoor gyms or parks — pull-up bars, parallel bars, functional training rigs.',
 'A steel outdoor pull-up/dip station.',
 '{pull-up bar,outdoor gym,fitness rig,parallel bars}'),
('Outdoor Living & Recreation', 10, 5, 'Sculptures & yard art', 'sculptures-yard-art',
 'Decorative metal sculptures or yard art, often custom-commissioned pieces.',
 'An abstract steel sculpture on a garden plinth.',
 '{yard sculpture,garden art,metal sculpture commission}'),
('Outdoor Living & Recreation', 10, 6, 'Planters & garden structures', 'planters-garden-structures',
 'Steel planter boxes, trellises, and other garden structures.',
 'A raised steel planter box, corten or painted steel.',
 '{steel planter,corten planter,trellis,garden structure}'),
('Outdoor Living & Recreation', 10, 7, 'Swing sets, custom jungle gyms', 'swing-sets-jungle-gyms',
 'Larger custom playground/jungle gym structures beyond basic playground equipment.',
 'A multi-level steel jungle gym with slide and climbing net.',
 '{jungle gym,custom playset,climbing net structure}');

-- ── 10. Security & Storage ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Security & Storage', 11, 1, 'Security bars & window guards', 'security-bars-window-guards',
 'Steel bars or grilles mounted over windows/doors for security, often on ground-floor commercial or residential units.',
 'A welded steel window security grille, vertical bar style.',
 '{window bars,security grille,window guard,burglar bars}'),
('Security & Storage', 11, 2, 'Storage racks (warehouse/garage)', 'storage-racks-warehouse-garage',
 'Heavy-duty pallet racking or garage storage racks.',
 'A steel pallet rack system in a warehouse.',
 '{pallet rack,garage storage rack,warehouse racking}'),
('Security & Storage', 11, 3, 'Lockers & cages', 'lockers-cages',
 'Steel storage lockers or security cages for tools/equipment/personal items.',
 'A row of steel mesh storage cages/lockers in a warehouse.',
 '{storage cage,tool locker,mesh locker,security cage}'),
('Security & Storage', 11, 4, 'Safe rooms / vault doors (structural)', 'safe-rooms-vault-doors',
 'Structural steel work for safe rooms or vault enclosures — framing and door structure (not necessarily the locking mechanism, which may be a purchased component).',
 'A heavy steel vault-style door on a reinforced frame.',
 '{vault door,safe room framing,panic room}'),
('Security & Storage', 11, 5, 'Bike racks', 'bike-racks',
 'Standalone bike racks for commercial or residential use.',
 'A steel loop or grid-style bike rack.',
 '{bike rack,bicycle parking}'),
('Security & Storage', 11, 6, 'Dumpster enclosures', 'dumpster-enclosures',
 'Steel-framed enclosures that screen dumpsters from view, often with gates.',
 'A steel-framed dumpster enclosure with slatted gates.',
 '{dumpster screen,trash enclosure,dumpster gate}');

-- ── 11. Signage & Display ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Signage & Display', 12, 1, 'Custom metal signs', 'custom-metal-signs',
 'Cut, engraved, or raised-letter metal signage for businesses or residences.',
 'A plasma-cut steel business sign with raised standoff lettering.',
 '{business sign,plasma cut sign,raised letter sign}'),
('Signage & Display', 12, 2, 'Sign frames & mounting structures', 'sign-frames-mounting-structures',
 'Structural frames that hold signage — pole signs, wall-mount frames, monument sign structures.',
 'A steel pole-mounted sign frame.',
 '{pole sign,monument sign,sign structure}'),
('Signage & Display', 12, 3, 'Retail display fixtures', 'retail-display-fixtures',
 'Custom steel display racks/fixtures for retail stores.',
 'A steel garment/display rack for a retail shop.',
 '{display rack,garment rack,store fixture}'),
('Signage & Display', 12, 4, 'Trade show/booth frames', 'trade-show-booth-frames',
 'Portable or semi-permanent steel/aluminum frames for trade show booths.',
 'A modular aluminum trade show booth frame.',
 '{booth frame,trade show display,portable frame}');

-- ── 12. Art & Custom Fabrication ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Art & Custom Fabrication', 13, 1, 'Metal sculptures', 'metal-sculptures',
 'Larger-scale artistic metalwork, often one-off commissions for public or private display.',
 'A large abstract steel sculpture, public plaza scale.',
 '{public art,sculpture commission,large scale metalwork}'),
('Art & Custom Fabrication', 13, 2, 'Custom emblems & logos', 'custom-emblems-logos',
 'Cut or fabricated metal versions of a company logo or personal emblem, often used as signage or wall art.',
 'A laser/plasma-cut steel company logo mounted on a wall.',
 '{metal logo,company emblem,wall logo}'),
('Art & Custom Fabrication', 13, 3, 'Memorial/monument work', 'memorial-monument-work',
 'Metal components of memorials or monuments — plaques, structural elements, decorative accents.',
 'A bronze or steel memorial plaque mounted on a stone base.',
 '{memorial plaque,monument metalwork,commemorative piece}'),
('Art & Custom Fabrication', 13, 4, 'Decorative wall art', 'decorative-wall-art',
 'Cut-metal wall art pieces for homes or businesses.',
 'A laser-cut steel wall art panel, nature or geometric pattern.',
 '{metal wall art,laser cut art,geometric panel}'),
('Art & Custom Fabrication', 13, 5, 'Custom furniture-art hybrids', 'furniture-art-hybrids',
 'Pieces that blur the line between furniture and sculpture — an artistic table base, a sculptural bench.',
 'A sculptural steel bench that doubles as an art piece.',
 '{sculptural bench,artistic table,art furniture}'),
('Art & Custom Fabrication', 13, 6, 'One-off client commissions', 'one-off-commissions',
 'Catch-all for bespoke projects that don''t fit a standard category — this is really a "contact us" category more than a product.',
 'N/A — represented by a portfolio gallery rather than a single image.',
 '{custom commission,bespoke project,not sure what I need,something custom,one of a kind}');

-- ── 13. Repair & Restoration ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Repair & Restoration', 14, 1, 'Antique/vintage equipment restoration', 'antique-vintage-restoration',
 'Restoring old machinery, vehicles, or ironwork to original or working condition.',
 'A restored vintage tractor or piece of antique farm equipment.',
 '{vintage tractor restoration,antique ironwork,restore old machinery}'),
('Repair & Restoration', 14, 2, 'Farm equipment repair', 'farm-equipment-repair-restoration',
 'General welding repair on farm machinery (overlaps with the Agricultural & Ranch section, listed here as a repair-specific service).',
 'A welder repairing a cracked plow or cultivator frame.',
 '{plow repair,cultivator repair,farm machinery welding}'),
('Repair & Restoration', 14, 3, 'Fabrication of obsolete/discontinued parts', 'obsolete-parts-fabrication',
 'Custom-making a replacement part that''s no longer manufactured or available.',
 'A hand-fabricated replica of an obsolete machine part next to the original.',
 '{discontinued part,replacement part,part no longer made,reverse engineer part}'),
('Repair & Restoration', 14, 4, 'Emergency/mobile welding repair', 'emergency-mobile-welding',
 'On-site emergency welding response via mobile welding rig, for breakdowns that can''t wait for shop transport.',
 'A mobile welding truck rig set up on-site at a job.',
 '{mobile welder,on-site welding,emergency repair,welding truck,same day welding}'),
('Repair & Restoration', 14, 5, 'Fleet vehicle repair', 'fleet-vehicle-repair',
 'Ongoing repair contracts for company or municipal vehicle fleets — racks, bumpers, structural repair.',
 'A fleet service van with a repaired rear bumper/step.',
 '{fleet repair contract,company van repair,municipal fleet}');

-- ── 14. Pipe, Tube & Handrail Systems ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Pipe, Tube & Handrail Systems', 15, 1, 'Handrail systems (ADA compliant)', 'ada-handrail-systems',
 'Railings built to ADA/code specifications for ramps, stairs, and accessible routes.',
 'A steel ADA-compliant handrail along a ramp.',
 '{ADA handrail,ramp railing,code compliant railing,accessibility railing}'),
('Pipe, Tube & Handrail Systems', 15, 2, 'Pipe bollards', 'pipe-bollards',
 'Steel pipe posts set in concrete to protect structures/pedestrians from vehicle impact.',
 'A row of yellow steel pipe bollards in front of a storefront.',
 '{bollard,storefront protection,vehicle barrier post}'),
('Pipe, Tube & Handrail Systems', 15, 3, 'Custom tube bending projects', 'custom-tube-bending',
 'General tube-bending fabrication work — anything requiring curved tube/pipe shapes.',
 'A bent-tube frame or handrail curve.',
 '{tube bending,pipe bending,curved handrail}'),
('Pipe, Tube & Handrail Systems', 15, 4, 'HVAC ductwork supports', 'hvac-ductwork-supports',
 'Steel hangers and supports for ductwork runs.',
 'A steel strut support cradling a rectangular duct run.',
 '{duct hanger,duct support,strut support}'),
('Pipe, Tube & Handrail Systems', 15, 5, 'Plumbing/process piping supports (non-pressure)', 'piping-supports-non-pressure',
 'Support structures for non-pressure piping runs (pressure piping would fall under a certified process).',
 'A pipe support rack under a run of process piping.',
 '{pipe support rack,process piping support}');

-- ── 15. Specialty / Niche ──
insert into clrwf_capabilities (category, category_order, item_order, name, slug, description, prototype_note, keywords) values
('Specialty / Niche', 16, 1, 'CNC plasma-cut decorative panels', 'cnc-plasma-cut-panels',
 'Precision plasma-cut steel panels for decorative or functional use, driven by CAD files.',
 'A CNC plasma-cut decorative panel with an intricate pattern.',
 '{plasma cut panel,CNC cut steel,decorative panel}'),
('Specialty / Niche', 16, 2, 'Laser-cut precision parts', 'laser-cut-precision-parts',
 'High-precision laser-cut steel or aluminum parts (if the shop has laser capability).',
 'A laser-cut sheet metal part with tight tolerances.',
 '{laser cut part,precision sheet metal,tight tolerance part}'),
('Specialty / Niche', 16, 3, 'Powder-coat-ready fabrication', 'powder-coat-ready-fabrication',
 'Fabrication finished to a standard ready for powder coating (paired with a local coating partner).',
 'A bare-metal fabricated part, cleaned and prepped, ready for the powder coat booth.',
 '{powder coat prep,painted finish fabrication}'),
('Specialty / Niche', 16, 4, 'Stainless/food-grade fabrication', 'stainless-food-grade-fabrication',
 'Fabrication meeting food-service sanitary standards — commercial kitchen equipment, food truck builds.',
 'A stainless steel food truck service window/counter.',
 '{food truck fabrication,sanitary stainless,commercial kitchen build}'),
('Specialty / Niche', 16, 5, 'Aluminum-specific fabrication', 'aluminum-fabrication',
 'Fabrication work specifically in aluminum — boats, trailers, trim pieces, lightweight structures.',
 'An aluminum boat hull or trailer component.',
 '{aluminum welding,aluminum boat,aluminum trailer,lightweight fabrication}'),
('Specialty / Niche', 16, 6, 'Pressure vessel / ASME code work', 'pressure-vessel-asme',
 'Certified fabrication of pressure vessels or piping under ASME code — tanks, pressure piping systems.',
 'An ASME-stamped steel pressure vessel/tank.',
 '{ASME tank,pressure vessel,certified pressure piping}');

-- ─────────────────────────────────────────────────────────────────────────
-- CLRWF voice notes (speech-to-text description fields)
-- ─────────────────────────────────────────────────────────────────────────
-- Customers describe the problem by talking instead of typing (Site
-- request: "anti-typing as much as possible"). The browser transcribes
-- live into the description/message textarea AND records the actual
-- audio -- both are kept, not just the transcript, so staff can listen
-- to the raw recording while driving instead of reading. voice_note_paths
-- holds Storage paths in the private clrwf-voice-notes bucket; each path's
-- extension reflects whatever MediaRecorder produced (webm/mp4/etc), same
-- "extension travels with the path" convention as photo_paths.
alter table clrwf_quote_requests add column if not exists voice_note_paths text[];
alter table clrwf_contact_messages add column if not exists voice_note_paths text[];
alter table clrwf_maintenance_agreement_requests add column if not exists voice_note_paths text[];

insert into storage.buckets (id, name, public)
values ('clrwf-voice-notes', 'clrwf-voice-notes', false)
on conflict (id) do nothing;

-- Same split as clrwf-job-photos: anon can upload their own recording but
-- never list or read anyone else's back (no anon select policy) -- only
-- staff, and the notify-submission Edge Function (service role), can
-- actually listen to what was recorded.
create policy "Allow anon insert to clrwf-voice-notes" on storage.objects
  for insert to anon
  with check (bucket_id = 'clrwf-voice-notes');

create policy "Staff can read clrwf-voice-notes" on storage.objects
  for select to authenticated
  using (bucket_id = 'clrwf-voice-notes' and public.clrwf_is_staff());

-- ===================================================================
-- CONTRACTS CRM (Job Acquisition Playbook) -- staff-only internal tool,
-- no anon access at all. Two tables: opportunities (the pipeline the
-- playbook's "Contracts CRM ownership" responsibility refers to -- source,
-- deadline, status, outcome, follow-up date) and certifications (the
-- annual/multi-year renewal cadence called out throughout the playbook --
-- SAM.gov, City MBE/WBE/DBE, Illinois BEP, NMSDC, etc).
-- ===================================================================

create table if not exists clrwf_contract_opportunities (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('federal', 'state', 'city', 'corporate', 'industrial')),
  title text not null,
  agency_or_buyer text,
  source text,
  description text,
  estimated_value numeric,
  deadline date,
  status text not null default 'identified' check (status in ('identified', 'qualifying', 'bid_submitted', 'awarded', 'lost', 'declined', 'no_bid')),
  outcome_notes text,
  submitted_at timestamptz,
  decided_at timestamptz,
  created_by uuid references clrwf_staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists clrwf_certifications (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  channel text not null check (channel in ('federal', 'state', 'city', 'corporate', 'industrial')),
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'active', 'expiring_soon', 'expired')),
  issued_at date,
  expires_at date,
  notes text,
  updated_by uuid references clrwf_staff(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clrwf_contract_opportunities enable row level security;
alter table clrwf_certifications enable row level security;

create policy "staff can read opportunities" on clrwf_contract_opportunities for select to authenticated using (public.clrwf_is_staff());
create policy "staff can manage opportunities" on clrwf_contract_opportunities for all to authenticated using (public.clrwf_is_staff()) with check (public.clrwf_is_staff());

create policy "staff can read certifications" on clrwf_certifications for select to authenticated using (public.clrwf_is_staff());
create policy "staff can manage certifications" on clrwf_certifications for all to authenticated using (public.clrwf_is_staff()) with check (public.clrwf_is_staff());

create index if not exists clrwf_contract_opportunities_channel_idx on clrwf_contract_opportunities (channel);
create index if not exists clrwf_contract_opportunities_status_idx on clrwf_contract_opportunities (status);
create index if not exists clrwf_contract_opportunities_deadline_idx on clrwf_contract_opportunities (deadline);
create index if not exists clrwf_certifications_channel_idx on clrwf_certifications (channel);

drop trigger if exists clrwf_contract_opportunities_touch on clrwf_contract_opportunities;
create trigger clrwf_contract_opportunities_touch
  before update on clrwf_contract_opportunities
  for each row execute function clrwf_set_updated_at();

drop trigger if exists clrwf_certifications_touch on clrwf_certifications;
create trigger clrwf_certifications_touch
  before update on clrwf_certifications
  for each row execute function clrwf_set_updated_at();

-- Seed the certifications the playbook names explicitly. MBE/WBE/DBE is
-- seeded 'active' because the playbook states this is already held; every
-- other row is seeded 'not_started' since actual status isn't something
-- to assume -- the owner action items on the Playbook page ask the owner
-- to confirm real status directly, matching the "no one's assigned/started
-- until confirmed" convention used elsewhere on this site.
insert into clrwf_certifications (name, channel, status, notes)
values
  ('City of Chicago MBE/WBE/DBE Certification', 'city', 'active', 'Already held per the Job Acquisition Playbook -- confirm area-of-specialty listing (welding/metal fabrication) is accurate in the DPS directory.'),
  ('SAM.gov Registration', 'federal', 'not_started', 'Mandatory and free -- required before any federal award or payment. Renews every 365 days.'),
  ('Illinois BEP (Fast-Track Reciprocal)', 'state', 'not_started', 'Fast-track "Be Enrolled" reciprocal application via CEI, referencing the existing City certification -- ~7 business days once filed.'),
  ('NMSDC MBE Certification', 'corporate', 'not_started', 'Separate paid certification via Chicago Minority Supplier Development Council ($270-$1,700/yr, scaled by revenue). Owner has not yet decided whether to pursue this.')
on conflict (name) do nothing;

-- ===================================================================
-- CAREERS: public job posting + application intake (currently just the
-- Government & Corporate Contracts Specialist role from the playbook).
-- Write-only from anon (never select), same pattern as clrwf_quote_requests
-- etc -- only staff can read applications back, via the Contracts CRM tab.
-- ===================================================================

create table if not exists clrwf_job_applications (
  id uuid primary key default gen_random_uuid(),
  position text not null default 'Government & Corporate Contracts Specialist',
  full_name text not null,
  email text not null,
  phone text,
  cover_letter text,
  resume_path text,
  voice_note_paths text[],
  status text not null default 'new' check (status in ('new', 'reviewing', 'interviewing', 'hired', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table clrwf_job_applications enable row level security;

create policy "anon can submit job application" on clrwf_job_applications for insert to anon with check (true);
create policy "staff can read job applications" on clrwf_job_applications for select to authenticated using (public.clrwf_is_staff());
create policy "staff can update job applications" on clrwf_job_applications for update to authenticated using (public.clrwf_is_staff()) with check (public.clrwf_is_staff());

create index if not exists clrwf_job_applications_status_idx on clrwf_job_applications (status);

drop trigger if exists clrwf_job_applications_touch on clrwf_job_applications;
create trigger clrwf_job_applications_touch
  before update on clrwf_job_applications
  for each row execute function clrwf_set_updated_at();

drop trigger if exists clrwf_job_applications_notify on clrwf_job_applications;
create trigger clrwf_job_applications_notify
  after insert on clrwf_job_applications
  for each row execute function notify_submission_webhook();

insert into storage.buckets (id, name, public)
values ('clrwf-resumes', 'clrwf-resumes', false)
on conflict (id) do nothing;

create policy "Allow anon insert to clrwf-resumes" on storage.objects
  for insert to anon
  with check (bucket_id = 'clrwf-resumes');

create policy "Staff can read clrwf-resumes" on storage.objects
  for select to authenticated
