-- One row per (lead, recipient) pair: tracks the WhatsApp delivery of a
-- single lead to a single recipient independently of every other recipient.
--
-- Why not a single status column on contact_leads: a lead fans out to N
-- active recipients, and recipients can be added or removed over time. A
-- single "whatsapp_status" on the lead can't represent "delivered to 3 of 4"
-- without losing information, and retrying it naively would re-send to
-- recipients who already got it. Tracking per-recipient means a retry only
-- targets the rows that haven't succeeded yet -- nobody gets duplicate
-- messages, and a recipient added after a lead was already processed simply
-- never gets a row for that lead (correct: they weren't on the list yet).
--
-- No network calls, no secrets. Safe to apply on its own (though it
-- references contact_leads and whatsapp_recipients, so must run after
-- those two migrations).

create table public.contact_lead_whatsapp_notifications (
  id               bigint generated always as identity primary key,
  lead_id          bigint not null references public.contact_leads(id) on delete cascade,
  recipient_id     bigint not null references public.whatsapp_recipients(id) on delete cascade,

  status           text not null default 'pending',
  attempts         smallint not null default 0,
  next_attempt_at  timestamptz not null default now(),

  message_id       text,       -- WhatsApp's wamid, once sent
  sent_at          timestamptz,
  last_error       text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  constraint contact_lead_whatsapp_notifications_status check (
    status in ('pending', 'processing', 'sent', 'failed', 'dead')
  ),
  constraint contact_lead_whatsapp_notifications_attempts check (attempts >= 0),
  constraint contact_lead_whatsapp_notifications_sent_shape check (
    (status = 'sent') = (message_id is not null and sent_at is not null)
  ),
  -- One notification row per (lead, recipient) -- this is what makes
  -- fanout_whatsapp_for_lead's `on conflict do nothing` safe to call more
  -- than once for the same lead.
  constraint contact_lead_whatsapp_notifications_unique unique (lead_id, recipient_id)
);

comment on table public.contact_lead_whatsapp_notifications is
  'Per-(lead, recipient) WhatsApp delivery tracking. Rows are created by '
  'fanout_whatsapp_for_lead for every active whatsapp_recipients row at the '
  'time a lead is inserted, and driven to a terminal status (sent/dead) by '
  'the whatsapp-notify Edge Function via the trigger + sweep, exactly '
  'mirroring the contact_leads/HubSpot retry pattern this replaced.';

-- Supports the retry sweep, which only ever scans unfinished rows.
create index contact_lead_whatsapp_notifications_retry_idx
  on public.contact_lead_whatsapp_notifications (next_attempt_at)
  where status in ('pending', 'processing', 'failed');

-- Supports "show me every notification for this lead" (debugging a single
-- submission) without a sequential scan.
create index contact_lead_whatsapp_notifications_lead_idx
  on public.contact_lead_whatsapp_notifications (lead_id);

create or replace function public.tg_whatsapp_notifications_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger whatsapp_notifications_touch
  before update on public.contact_lead_whatsapp_notifications
  for each row execute function public.tg_whatsapp_notifications_touch();

alter table public.contact_lead_whatsapp_notifications enable row level security;
alter table public.contact_lead_whatsapp_notifications force row level security;
revoke all on public.contact_lead_whatsapp_notifications from public, anon, authenticated;
grant select, insert, update, delete on public.contact_lead_whatsapp_notifications to service_role;

notify pgrst, 'reload schema';
