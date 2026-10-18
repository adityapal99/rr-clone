-- Contact-form leads: the table the Next.js /api/contact route inserts into.
--
-- No network calls, no secrets. Safe to apply on its own.
--
-- Data API exposure: as of Supabase's 2026-04-28 change (enforced for all
-- projects by 2026-10-30), a new `public` table is NOT reachable through the
-- Data API for any role -- including service_role -- until it is explicitly
-- granted. This migration grants service_role only, and grants nothing to
-- anon/authenticated. See the RLS + grants section below.
--
-- Notification status (WhatsApp delivery, per recipient) lives in its own
-- join table (contact_lead_whatsapp_notifications, see
-- 20261007173320_whatsapp_notifications.sql), not as columns here -- a lead
-- fans out to N recipients, so a single status/attempts pair on this row
-- can't represent "delivered to 3 of 4" without losing information.

create table public.contact_leads (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  name        text not null,
  email       text not null,
  phone       text,
  message     text not null,
  locale      text not null default 'en',

  constraint contact_leads_name_len    check (char_length(name) between 1 and 200),
  constraint contact_leads_email_len   check (char_length(email) between 3 and 320),
  constraint contact_leads_email_lower check (email = lower(email)),
  constraint contact_leads_phone_len   check (phone is null or char_length(phone) between 3 and 40),
  constraint contact_leads_message_len check (char_length(message) between 1 and 5000),
  constraint contact_leads_locale      check (locale in ('en', 'ar'))
);

comment on table public.contact_leads is
  'Contact-us form submissions. Contains personal data (name, email, phone, '
  'free-text message). service_role only, by design -- the absence of '
  'permissive RLS policies below is deliberate. Do not add a policy to "fix" '
  'this without re-reading why RLS is enabled with none.';

-- Supports the daily report's "created_at between two business-day bounds"
-- scan (see contact_leads_for_business_day in report_rpcs.sql).
create index contact_leads_created_at_idx on public.contact_leads (created_at);

-- Operational lookups ("has this email written in before?").
create index contact_leads_email_idx on public.contact_leads (email);

-- ---------------------------------------------------------------------------
-- Normalise on write: trim strings, lowercase email, blank phone -> null.
-- Doing this in a trigger (rather than trusting the caller) means the
-- contact_leads_email_lower check constraint above can never be violated by
-- a client that forgets to lowercase, and every downstream consumer (the
-- WhatsApp notification, the report) sees consistent data.
-- ---------------------------------------------------------------------------
create or replace function public.tg_contact_leads_normalise()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.name    := btrim(new.name);
  new.email   := lower(btrim(new.email));
  new.message := btrim(new.message);
  new.phone   := nullif(btrim(coalesce(new.phone, '')), '');
  new.updated_at := now();
  return new;
end;
$$;

create trigger contact_leads_normalise
  before insert or update on public.contact_leads
  for each row execute function public.tg_contact_leads_normalise();

-- ---------------------------------------------------------------------------
-- RLS + grants.
--
-- RLS is enabled with zero permissive policies. That looks like it does
-- nothing today, because the only accessor is the secret key (service_role),
-- which bypasses RLS entirely -- the value is entirely in what it prevents
-- later, if an anon-key read path is ever added without anyone revisiting
-- this file. `force row level security` additionally applies RLS even to the
-- table owner.
-- ---------------------------------------------------------------------------
alter table public.contact_leads enable row level security;
alter table public.contact_leads force row level security;

revoke all on public.contact_leads from public, anon, authenticated;
grant select, insert, update, delete on public.contact_leads to service_role;

-- The Data API's schema cache can lag a migration; make sure PostgREST picks
-- up the new table and grants immediately rather than on its next poll.
notify pgrst, 'reload schema';
