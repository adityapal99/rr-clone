-- Rate limiting for the public contact-form endpoint.
--
-- Why this lives in Postgres rather than in the Next.js route: route handlers
-- on a lambda-style host get a fresh isolate per cold start and N warm
-- isolates in parallel, so an in-memory counter enforces a limit of
-- "N x (however many isolates happen to be warm)", not the limit you asked
-- for. It also isn't shared across regions. A Postgres table gives an atomic,
-- durable counter for the cost of a statement the route was already paying
-- for (it inserts through this same connection either way).
--
-- Two buckets, both keyed on a salted hash computed in the Next.js route --
-- the raw IP address never reaches this table:
--   ip:<sha256(ip + salt)>     5  requests / 10 minutes
--   email:<sha256(email+salt)> 3  requests / 24 hours
-- The per-email bucket is what actually stops an IP-rotating bot; the
-- per-IP bucket catches a single noisy client.

create table public.contact_rate_limits (
  bucket_key    text primary key,
  window_start  timestamptz not null default now(),
  hit_count     integer not null default 0,
  constraint contact_rate_limits_count check (hit_count >= 0)
);

comment on table public.contact_rate_limits is
  'Fixed-window rate-limit counters for the contact form. Keys are salted '
  'hashes of IP/email, never raw values -- see consume_rate_limit.';

create index contact_rate_limits_window_idx on public.contact_rate_limits (window_start);

alter table public.contact_rate_limits enable row level security;
alter table public.contact_rate_limits force row level security;
revoke all on public.contact_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.contact_rate_limits to service_role;

-- ---------------------------------------------------------------------------
-- consume_rate_limit: atomic fixed-window counter.
--
-- One statement, no read-then-write race: `insert ... on conflict do update`
-- either creates the bucket at count 1, or -- if the existing window has
-- expired -- resets it to count 1, or otherwise increments it. Returns
-- whether the caller is still within `p_limit` for the window.
--
-- Fixed-window (not sliding) means a caller can send up to 2x p_limit across
-- a window boundary. For a marketing contact form that is an acceptable
-- trade for not needing a second moving-window data structure or a
-- dependency like Redis.
-- ---------------------------------------------------------------------------
create or replace function public.consume_rate_limit(
  p_key    text,
  p_limit  integer,
  p_window interval
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  insert into public.contact_rate_limits as r (bucket_key, window_start, hit_count)
  values (p_key, now(), 1)
  on conflict (bucket_key) do update
    set window_start = case when r.window_start < now() - p_window then now() else r.window_start end,
        hit_count    = case when r.window_start < now() - p_window then 1 else r.hit_count + 1 end
  returning r.hit_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_rate_limit(text, integer, interval)
  from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, integer, interval) to service_role;

-- ---------------------------------------------------------------------------
-- submit_contact_lead: the one round trip the Next.js route makes.
--
-- Checks both rate-limit buckets and inserts the lead in a single statement.
-- Returns a reason string rather than throwing, so the route can distinguish
-- "rate limited" (429) from "unexpected error" (503) without parsing a
-- Postgres exception. The returned `id` is for server-side logging only
-- (never returned to the browser) -- the route's own response body never
-- includes it.
-- ---------------------------------------------------------------------------
create or replace function public.submit_contact_lead(
  p_name        text,
  p_email       text,
  p_phone       text,
  p_message     text,
  p_locale      text,
  p_ip_hash     text,
  p_email_hash  text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id bigint;
begin
  if not public.consume_rate_limit('ip:' || p_ip_hash, 5, interval '10 minutes') then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited_ip');
  end if;

  if not public.consume_rate_limit('email:' || p_email_hash, 3, interval '24 hours') then
    return jsonb_build_object('ok', false, 'reason', 'rate_limited_email');
  end if;

  insert into public.contact_leads (name, email, phone, message, locale)
  values (p_name, p_email, p_phone, p_message, p_locale)
  returning id into v_id;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

revoke all on function public.submit_contact_lead(text, text, text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_contact_lead(text, text, text, text, text, text, text)
  to service_role;
