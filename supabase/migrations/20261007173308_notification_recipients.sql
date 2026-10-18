-- Two admin-managed recipient lists. Neither has an app-facing UI -- add,
-- remove, or deactivate rows directly in Supabase Studio's table editor
-- (Studio connects as an elevated role that bypasses RLS, same as any other
-- table in this project). `is_active = false` is preferred over deleting a
-- row: it keeps history (when a number/email was in rotation) without
-- requiring anyone to remember what it was.
--
-- No network calls, no secrets. Safe to apply on its own.

-- ---------------------------------------------------------------------------
-- whatsapp_recipients: phone numbers notified on every new lead (see
-- contact_lead_whatsapp_notifications in 20261007173320_whatsapp_notifications.sql
-- and the fan-out trigger in 20261007173340_automation.sql).
-- ---------------------------------------------------------------------------
create table public.whatsapp_recipients (
  id            bigint generated always as identity primary key,
  phone_number  text not null unique,
  label         text,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- E.164: a leading '+', then 7-15 digits, first digit 1-9. The WhatsApp
  -- Cloud API's `to` field expects exactly this shape (see
  -- supabase/functions/_shared/whatsapp.ts).
  constraint whatsapp_recipients_phone_format check (phone_number ~ '^\+[1-9]\d{6,14}$')
);

comment on table public.whatsapp_recipients is
  'Phone numbers (E.164, e.g. +9715XXXXXXXX) that receive a WhatsApp '
  'notification for every new contact-form lead. Manage rows directly in '
  'Studio; there is no admin UI. Prefer is_active = false over deleting a '
  'row you might want back.';

create or replace function public.tg_whatsapp_recipients_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.phone_number := btrim(new.phone_number);
  new.updated_at := now();
  return new;
end;
$$;

create trigger whatsapp_recipients_touch
  before insert or update on public.whatsapp_recipients
  for each row execute function public.tg_whatsapp_recipients_touch();

alter table public.whatsapp_recipients enable row level security;
alter table public.whatsapp_recipients force row level security;
revoke all on public.whatsapp_recipients from public, anon, authenticated;
grant select, insert, update, delete on public.whatsapp_recipients to service_role;

-- ---------------------------------------------------------------------------
-- report_recipients: email addresses that receive the daily leads
-- spreadsheet (see daily-leads-report, which reads this table at send time
-- rather than using a single fixed address).
-- ---------------------------------------------------------------------------
create table public.report_recipients (
  id          bigint generated always as identity primary key,
  email       text not null unique,
  label       text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint report_recipients_email_len   check (char_length(email) between 3 and 320),
  constraint report_recipients_email_lower check (email = lower(email)),
  constraint report_recipients_email_shape check (email like '%_@_%._%')
);

comment on table public.report_recipients is
  'Email addresses that receive the daily contact-leads spreadsheet. '
  'Manage rows directly in Studio; there is no admin UI.';

create or replace function public.tg_report_recipients_normalise()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.email := lower(btrim(new.email));
  new.updated_at := now();
  return new;
end;
$$;

create trigger report_recipients_normalise
  before insert or update on public.report_recipients
  for each row execute function public.tg_report_recipients_normalise();

alter table public.report_recipients enable row level security;
alter table public.report_recipients force row level security;
revoke all on public.report_recipients from public, anon, authenticated;
grant select, insert, update, delete on public.report_recipients to service_role;

notify pgrst, 'reload schema';
