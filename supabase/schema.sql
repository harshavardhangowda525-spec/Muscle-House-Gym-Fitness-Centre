-- ============================================================================
-- Muscle House Gym — memberships, UPI payment settings and admin access
--
-- Run this once in Supabase: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to re-run: tables use IF NOT EXISTS, functions/policies are replaced.
--
-- Security model
--   * Visitors (anon key) can only read active plans and the UPI settings.
--   * Logged-in members can read their OWN memberships (linked to their login
--     by the admin) — never anyone else's — and can't create, change or delete
--     anything. Members join via WhatsApp; only admins record memberships.
--   * Prices, plan length and status are set by the database, not the browser,
--     so a visitor cannot submit a different amount or mark themselves active.
--   * Only users listed in public.admins can read/manage memberships and change
--     settings or prices.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- admins
create table if not exists public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Today's date in India (Supabase servers run in UTC).
create or replace function public.ist_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Kolkata')::date;
$$;

-- ---------------------------------------------------------------- settings
create table if not exists public.settings (
  id                 smallint primary key default 1 check (id = 1),
  upi_id             text check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,64}@[A-Za-z][A-Za-z0-9.-]{1,63}$'),
  payee_name         text check (payee_name is null or char_length(payee_name) between 2 and 60),
  show_sample_notice boolean not null default true,
  updated_at         timestamptz not null default now()
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- ---------------------------------------------------------------- plans
create table if not exists public.plans (
  id     text primary key,
  name   text not null,
  months integer not null check (months between 1 and 36),
  price  integer not null check (price between 1 and 1000000),   -- whole rupees
  sort   smallint not null default 0,
  active boolean not null default true
);
-- Sample prices (placeholders) — change them in the admin dashboard.
insert into public.plans (id, name, months, price, sort) values
  ('monthly',     'Monthly',     1,  2000, 1),
  ('quarterly',   'Quarterly',   3,  5500, 2),
  ('half-yearly', 'Half-Yearly', 6,  9500, 3),
  ('annual',      'Annual',      12, 16000, 4)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- memberships
create table if not exists public.memberships (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  full_name      text not null check (char_length(full_name) between 2 and 80),
  phone          text not null check (phone ~ '^[6-9][0-9]{9}$'),
  plan_id        text not null references public.plans (id),
  plan_name      text not null,
  months         integer not null,
  amount         integer not null,
  payment_method text not null default 'upi' check (payment_method in ('upi', 'cash', 'other')),
  upi_ref        text check (upi_ref is null or upi_ref ~ '^[A-Z0-9]{6,35}$'),
  status         text not null default 'pending' check (status in ('pending', 'verified', 'rejected')),
  start_date     date,
  end_date       date,
  reviewed_at    timestamptz,
  admin_note     text check (admin_note is null or char_length(admin_note) <= 500),
  constraint upi_needs_ref check (payment_method <> 'upi' or upi_ref is not null)
);
create unique index if not exists memberships_upi_ref_key on public.memberships (upi_ref) where upi_ref is not null;
create index if not exists memberships_created_at_idx on public.memberships (created_at desc);

-- Member accounts: each online request is linked to the member's login.
-- (ADD COLUMN IF NOT EXISTS keeps this safe on databases created earlier.)
alter table public.memberships add column if not exists user_id uuid references auth.users (id) on delete set null;
alter table public.memberships add column if not exists email   text;
create index if not exists memberships_user_id_idx on public.memberships (user_id);

-- Sets price/plan from the plans table, forces safe defaults for public
-- submissions, and keeps start/end dates consistent with the status.
create or replace function public.memberships_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p          public.plans%rowtype;
  admin_user boolean := public.is_admin();
begin
  if tg_op = 'INSERT' then
    select * into p from public.plans where id = new.plan_id and (active or admin_user);
    if not found then
      raise exception 'Unknown or inactive plan' using errcode = '22023';
    end if;

    new.id         := gen_random_uuid();
    new.created_at := now();
    new.plan_name  := p.name;
    new.months     := p.months;
    new.amount     := p.price;
    new.full_name  := btrim(new.full_name);
    new.upi_ref    := nullif(upper(btrim(coalesce(new.upi_ref, ''))), '');

    if not admin_user then
      -- Online sign-ups need a logged-in member; link the request to them.
      if auth.uid() is null then
        raise exception 'Please log in to join' using errcode = '42501';
      end if;
      new.user_id := auth.uid();
      new.email   := (select email from auth.users where id = auth.uid());

      -- Always UPI, always pending, never pre-dated.
      new.payment_method := 'upi';
      new.status         := 'pending';
      new.start_date     := null;
      new.admin_note     := null;

      -- Basic abuse protection: max 3 pending requests per phone or account per day.
      if (select count(*) from public.memberships
          where (phone = new.phone or user_id = new.user_id) and status = 'pending'
            and created_at > now() - interval '1 day') >= 3 then
        raise exception 'Too many pending requests' using errcode = 'P0001';
      end if;
    else
      -- Admin adding a member: link it to the member's website login by email
      -- (if they have one) so it appears under their "My membership".
      new.email := nullif(lower(btrim(coalesce(new.email, ''))), '');
      if new.user_id is null and new.email is not null then
        new.user_id := (select id from auth.users where lower(email) = new.email limit 1);
      elsif new.user_id is not null and new.email is null then
        new.email := (select email from auth.users where id = new.user_id);
      end if;
    end if;
  else -- UPDATE: plan, price and submission details are immutable
    new.id         := old.id;
    new.created_at := old.created_at;
    new.plan_id    := old.plan_id;
    new.plan_name  := old.plan_name;
    new.months     := old.months;
    new.amount     := old.amount;
    -- Account link can be set once (e.g. to attach an older request), never changed.
    new.user_id    := coalesce(old.user_id, new.user_id);
    new.email      := coalesce(old.email, new.email);
  end if;

  if new.status = 'verified' then
    new.start_date := coalesce(new.start_date, public.ist_today());
    new.end_date   := (new.start_date + make_interval(months => new.months) - interval '1 day')::date;
    if tg_op = 'INSERT' or old.status is distinct from 'verified' then
      new.reviewed_at := now();
    end if;
  else
    new.start_date := null;
    new.end_date   := null;
    new.reviewed_at := case when new.status = 'rejected' then now() else null end;
  end if;

  return new;
end;
$$;

drop trigger if exists memberships_guard on public.memberships;
create trigger memberships_guard
  before insert or update on public.memberships
  for each row execute function public.memberships_guard();

-- Keep settings.updated_at fresh.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); new.id := 1; return new; end; $$;
drop trigger if exists settings_touch on public.settings;
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------- privileges
alter table public.admins      enable row level security;
alter table public.settings    enable row level security;
alter table public.plans       enable row level security;
alter table public.memberships enable row level security;

revoke all on public.admins, public.settings, public.plans, public.memberships from anon, authenticated;
grant select                         on public.admins      to authenticated;
grant select                         on public.settings    to anon, authenticated;
grant update                         on public.settings    to authenticated;
grant select                         on public.plans       to anon, authenticated;
grant update                         on public.plans       to authenticated;
grant insert                         on public.memberships to authenticated;
grant select, update, delete         on public.memberships to authenticated;
grant execute on function public.is_admin() to anon, authenticated;

-- admins: a signed-in user can only see their own admin row
drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins
  for select to authenticated using (user_id = auth.uid());

-- settings: public read (the website needs the UPI ID for the QR), admin write
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings
  for select to anon, authenticated using (true);
drop policy if exists settings_admin_update on public.settings;
create policy settings_admin_update on public.settings
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- plans: public read of active plans, admin read/update of all
drop policy if exists plans_read on public.plans;
create policy plans_read on public.plans
  for select to anon, authenticated using (active or public.is_admin());
drop policy if exists plans_admin_update on public.plans;
create policy plans_admin_update on public.plans
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- memberships: logged-in members may submit and see only their own records;
-- only admins may read everything, change or delete
-- Online payments are switched off: members join via WhatsApp and only admins
-- record memberships. (To re-enable online requests, change this check to true.)
drop policy if exists memberships_submit on public.memberships;
create policy memberships_submit on public.memberships
  for insert to authenticated with check (public.is_admin());
drop policy if exists memberships_admin_read on public.memberships;
drop policy if exists memberships_read on public.memberships;
create policy memberships_read on public.memberships
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
drop policy if exists memberships_admin_update on public.memberships;
create policy memberships_admin_update on public.memberships
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists memberships_admin_delete on public.memberships;
create policy memberships_admin_delete on public.memberships
  for delete to authenticated using (public.is_admin());

-- ============================================================================
-- Make the gym owner an admin (run AFTER creating their login under
-- Authentication → Users → Add user). Replace the email address:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'owner@example.com';
-- ============================================================================
