-- Wires contact_leads up to the whatsapp-notify Edge Function: an
-- after-insert trigger that fans a new lead out to every active
-- whatsapp_recipients row and fires a low-latency push, a 15-minute sweep
-- as the actual delivery guarantee, and the two daily-report cron jobs.
--
-- Requires two Vault secrets to already exist (created once, by hand, not
-- by this migration -- a secret value has no business living in a committed
-- file):
--
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<sb_secret_...>', 'edge_function_secret_key');
--
-- Until both exist, invoke_edge_function logs a warning and no-ops rather
-- than failing the insert that triggered it -- a contact-form submission
-- must never fail because the notification pipeline isn't wired up yet.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Vault should already be enabled on a Supabase project; this is a no-op if
-- so, and only matters for a from-scratch local `supabase start`.
create extension if not exists supabase_vault;

-- ---------------------------------------------------------------------------
-- invoke_edge_function: the only place a Vault secret is read and turned
-- into an auth header. The trigger, the WhatsApp sweep, and the two report
-- cron jobs all call this, so there is exactly one place that constructs
-- the request.
--
-- pg_net's default timeout (2000ms) is shorter than a cold-start Deno
-- function plus an external API round trip routinely takes -- with the
-- default, "the call actually succeeded" and "pg_net gave up waiting" would
-- be indistinguishable from the caller's point of view. 20s avoids paying
-- that latency tax on every single invocation.
-- ---------------------------------------------------------------------------
create or replace function public.invoke_edge_function(
  p_name    text,
  p_body    jsonb,
  p_timeout integer default 20000
) returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
  v_key text;
begin
  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'project_url';
  select decrypted_secret into v_key
    from vault.decrypted_secrets where name = 'edge_function_secret_key';

  if v_url is null or v_key is null then
    raise warning 'invoke_edge_function: vault secrets not configured yet, skipping call to %', p_name;
    return null;
  end if;

  -- pg_net exposes its functions under a fixed `net` schema regardless of
  -- which schema owns the extension for catalog purposes (`extensions`,
  -- above) -- it is `net.http_post`, not `extensions.http_post`.
  return net.http_post(
    url     := v_url || '/functions/v1/' || p_name,
    body    := p_body,
    params  := '{}'::jsonb,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'apikey',       v_key
               ),
    timeout_milliseconds := p_timeout
  );
end;
$$;

revoke all on function public.invoke_edge_function(text, jsonb, integer)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- fanout_whatsapp_for_lead: creates one pending notification row per
-- currently-active whatsapp_recipients row, for one lead. Called once, from
-- the after-insert trigger, in the SAME transaction as the lead insert --
-- so the fan-out rows exist reliably even if the subsequent Edge Function
-- call never arrives (the sweep will still find them).
--
-- `on conflict do nothing` makes this safe to call again for a lead that
-- already has some notification rows (e.g. if ever invoked manually for
-- backfill) -- it only adds rows for recipients that don't already have one.
-- ---------------------------------------------------------------------------
create or replace function public.fanout_whatsapp_for_lead(p_lead_id bigint)
returns bigint[]
language sql
security definer
set search_path = ''
as $$
  with ins as (
    insert into public.contact_lead_whatsapp_notifications (lead_id, recipient_id)
    select p_lead_id, r.id
      from public.whatsapp_recipients r
     where r.is_active
    on conflict (lead_id, recipient_id) do nothing
    returning id
  )
  select coalesce(array_agg(id), '{}') from ins;
$$;

revoke all on function public.fanout_whatsapp_for_lead(bigint) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- After-insert trigger: fans out, then nudges whatsapp-notify for
-- low-latency delivery. A latency optimisation, NOT the delivery guarantee
-- -- pg_net fires the request only after the transaction commits and the
-- database never learns whether it arrived. The system is correct
-- *because* the sweep below exists, not because this trigger does.
-- ---------------------------------------------------------------------------
create or replace function public.tg_contact_leads_notify_whatsapp()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
begin
  v_ids := public.fanout_whatsapp_for_lead(new.id);
  if array_length(v_ids, 1) is not null then
    perform public.invoke_edge_function(
      'whatsapp-notify',
      jsonb_build_object('notification_ids', to_jsonb(v_ids))
    );
  end if;
  return null;
end;
$$;

create trigger contact_leads_notify_whatsapp
  after insert on public.contact_leads
  for each row execute function public.tg_contact_leads_notify_whatsapp();

-- ---------------------------------------------------------------------------
-- claim_whatsapp_notifications: the concurrency fix, same pattern as the
-- HubSpot-sync claim this replaced. Both the trigger and the sweep can call
-- whatsapp-notify for the same notification row; this is what makes that
-- overlap harmless instead of a double-send:
--
--   * `for update of n skip locked` means two concurrent callers never
--     claim the same row -- whichever transaction gets there first wins it.
--   * `attempts` is incremented *before* the WhatsApp API call is made, so
--     a mid-call crash still counts toward the cap (a poison payload can't
--     loop forever).
--   * `next_attempt_at` is pushed forward by a 10-minute lease as part of
--     the same claim, so a crashed worker's row falls due again rather than
--     being stuck in `processing` forever.
--
-- Returns fully denormalised rows (joined to the recipient's phone number
-- and the lead's own fields) so whatsapp-notify never needs a second query.
-- ---------------------------------------------------------------------------
create or replace function public.claim_whatsapp_notifications(p_ids bigint[])
returns table (
  notification_id  bigint,
  lead_id          bigint,
  recipient_id     bigint,
  attempts         smallint,
  phone_number     text,
  name             text,
  email            text,
  phone            text,
  message          text,
  locale           text,
  lead_created_at  timestamptz
)
language sql
security definer
set search_path = ''
as $$
  with due as (
    select n.id
      from public.contact_lead_whatsapp_notifications n
      join public.whatsapp_recipients r on r.id = n.recipient_id and r.is_active
     where n.id = any(p_ids)
       and n.status in ('pending', 'processing', 'failed')
       and n.next_attempt_at <= now()
     order by n.id
     for update of n skip locked
  ),
  claimed as (
    update public.contact_lead_whatsapp_notifications n
       set status = 'processing',
           attempts = n.attempts + 1,
           next_attempt_at = now() + interval '10 minutes'
      from due
     where n.id = due.id
    returning n.id as notification_id, n.lead_id, n.recipient_id, n.attempts
  )
  select
    c.notification_id, c.lead_id, c.recipient_id, c.attempts,
    r.phone_number, l.name, l.email, l.phone, l.message, l.locale, l.created_at as lead_created_at
    from claimed c
    join public.whatsapp_recipients r on r.id = c.recipient_id
    join public.contact_leads l on l.id = c.lead_id;
$$;

-- due_whatsapp_notification_ids: what the sweep passes to
-- claim_whatsapp_notifications. Scoped to recipients still `is_active` --
-- a deactivated number's pending notifications simply stop being due,
-- rather than needing a separate cleanup step.
create or replace function public.due_whatsapp_notification_ids(p_limit integer default 50)
returns bigint[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(n.id order by n.next_attempt_at), '{}')
    from (
      select n.id, n.next_attempt_at
        from public.contact_lead_whatsapp_notifications n
        join public.whatsapp_recipients r on r.id = n.recipient_id and r.is_active
       where n.status in ('pending', 'processing', 'failed')
         and n.next_attempt_at <= now()
       order by n.next_attempt_at
       limit p_limit
    ) n;
$$;

revoke all on function public.claim_whatsapp_notifications(bigint[])  from public, anon, authenticated;
revoke all on function public.due_whatsapp_notification_ids(integer)  from public, anon, authenticated;
grant execute on function public.claim_whatsapp_notifications(bigint[]) to service_role;
grant execute on function public.due_whatsapp_notification_ids(integer) to service_role;

-- ---------------------------------------------------------------------------
-- sweep_whatsapp_notifications: the actual guarantee. Retires anything past
-- the attempt cap, then re-invokes whatsapp-notify for whatever is still
-- due (covers both "the trigger's request never arrived" and "a claimed
-- row's 10-minute lease expired because the function crashed mid-call").
--
-- The attempt cap (5) lives ONLY here -- do not also define it as an Edge
-- Function env var or the two will drift and a row will end up stuck in a
-- retry loop the cap was supposed to stop.
-- ---------------------------------------------------------------------------
create or replace function public.sweep_whatsapp_notifications()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ids bigint[];
begin
  update public.contact_lead_whatsapp_notifications
     set status = 'dead'
   where status in ('pending', 'processing', 'failed')
     and attempts >= 5;

  v_ids := public.due_whatsapp_notification_ids(50);
  if array_length(v_ids, 1) is null then
    return;
  end if;

  perform public.invoke_edge_function(
    'whatsapp-notify',
    jsonb_build_object('notification_ids', to_jsonb(v_ids))
  );

  -- Housekeeping: rate-limit buckets older than 48h are never read again.
  delete from public.contact_rate_limits where window_start < now() - interval '48 hours';
end;
$$;

revoke all on function public.sweep_whatsapp_notifications() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Cron jobs. Schedules are UTC. 05:00 UTC = 09:00 UAE time year-round --
-- Asia/Dubai is a fixed UTC+04:00 with no DST, so this offset never needs
-- revisiting. Three jobs total, comfortably under Supabase's
-- "no more than 8 concurrent" guidance; each finishes in milliseconds since
-- net.http_post is async and returns immediately.
-- ---------------------------------------------------------------------------

-- Retry sweep, every 15 minutes.
select cron.schedule(
  'whatsapp-notifications-sweep',
  '*/15 * * * *',
  $cron$ select public.sweep_whatsapp_notifications(); $cron$
);

-- Daily report, 09:00 UAE time. business_day is computed here (not left to
-- the Edge Function to default) so the cron job's intent is visible from
-- the migration alone. 'Asia/Dubai' here must match
-- supabase/functions/_shared/config.ts's REPORT_TIMEZONE.
select cron.schedule(
  'contact-leads-daily-report',
  '0 5 * * *',
  $cron$
    select public.invoke_edge_function(
      'daily-leads-report',
      jsonb_build_object(
        'report_date',
        ((now() at time zone 'Asia/Dubai')::date - 1)::text
      ),
      60000
    );
  $cron$
);

-- Conditional retry, 11:00 UAE time. Only fires if the morning run never
-- reached `sent` -- without this, one cold-start failure means a silently
-- missing day.
select cron.schedule(
  'contact-leads-daily-report-retry',
  '0 7 * * *',
  $cron$
    select public.invoke_edge_function('daily-leads-report', jsonb_build_object('report_date', d::text), 60000)
      from (select ((now() at time zone 'Asia/Dubai')::date - 1) as d) x
     where not exists (
       select 1 from public.report_runs where report_date = x.d and status = 'sent'
     );
  $cron$
);
