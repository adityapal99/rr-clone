-- RPCs and state used by daily-leads-report: the business-day query window
-- and the report_runs audit/idempotency table.

-- ---------------------------------------------------------------------------
-- contact_leads_for_business_day: the ONLY place the report's day boundary
-- is defined. Both call sites (the cron job and a manual re-run) pass a
-- plain `date` and an IANA timezone name and let this function do the
-- arithmetic, so there is exactly one place that can get the offset wrong.
--
-- The timezone is passed as a parameter rather than hardcoded so a future
-- change of business timezone is a config change (see
-- supabase/functions/_shared/config.ts's REPORT_TIMEZONE, which must agree
-- with whatever the cron job in 20261007173340_automation.sql passes here),
-- not a migration. Today that value is 'Asia/Dubai' -- a fixed UTC+04:00
-- with no DST.
--
-- Half-open bounds (>=, <), never `between` -- `between` is inclusive on
-- both ends and would double-count a row created exactly at the boundary.
-- ---------------------------------------------------------------------------
create or replace function public.contact_leads_for_business_day(p_day date, p_timezone text)
returns setof public.contact_leads
language sql
stable
security definer
set search_path = ''
as $$
  select *
    from public.contact_leads
   where created_at >=  (p_day       :: timestamp at time zone p_timezone)
     and created_at <  ((p_day + 1)  :: timestamp at time zone p_timezone)
   order by created_at;
$$;

revoke all on function public.contact_leads_for_business_day(date, text) from public, anon, authenticated;
grant execute on function public.contact_leads_for_business_day(date, text) to service_role;

-- ---------------------------------------------------------------------------
-- report_runs: durable idempotency for the daily report.
--
-- The email provider's own de-duplication (e.g. an Idempotency-Key) only
-- protects a short window, which is useless against "re-run last Tuesday's
-- report by hand". report_date as the primary key plus a status check
-- before sending is what actually makes a re-invocation (manual, or the
-- follow-up retry cron) safe.
-- ---------------------------------------------------------------------------
create table public.report_runs (
  report_date       date primary key,
  status            text not null default 'pending',
  lead_count        integer,
  recipient_count   integer,
  provider_message_id text,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint report_runs_status check (status in ('pending', 'sent', 'failed'))
);

comment on table public.report_runs is
  'One row per business day the daily-leads-report function has attempted. '
  'status=sent makes a re-invocation for the same day a safe no-op.';

create or replace function public.tg_report_runs_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger report_runs_touch
  before update on public.report_runs
  for each row execute function public.tg_report_runs_touch();

alter table public.report_runs enable row level security;
alter table public.report_runs force row level security;
revoke all on public.report_runs from public, anon, authenticated;
grant select, insert, update, delete on public.report_runs to service_role;

notify pgrst, 'reload schema';
