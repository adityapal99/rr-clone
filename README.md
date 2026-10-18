# Trends Garments

A Next.js (App Router) + TypeScript rebuild of the Trends Garments marketing
site: the copy and structure come from the original site, restyled in the
dark, editorial design language of rolls-roycemotorcars.com, with a custom
"liquid glass" cursor and full English/Arabic (RTL) internationalization.

## Stack

- **Next.js 16** (App Router, Turbopack, typed routes)
- **TypeScript**, strict mode
- **Tailwind CSS v4**
- **next-intl** for i18n/routing (`/`, `/ar`) — see `i18n/` and `messages/`

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000 (English) or http://localhost:3000/ar (Arabic).

```bash
npm run build   # production build + typecheck
npm run lint    # ESLint
```

## Project structure

```
app/[locale]/       Root layout + the single home page
components/
  cursor/           The liquid-glass cursor (LiquidGlassCursor + its SVG filter)
  layout/           Header, fullscreen nav overlay, footer, locale switcher
  sections/         Hero, split panels, category grid, story blocks, contact
  ui/               Small shared primitives (scroll-reveal, category icons)
i18n/               next-intl routing, navigation helpers, request config
lib/content.ts      Structural content (image URLs, hrefs, category order)
messages/           en.json / ar.json — all translatable copy
```

## Adding a locale

1. Add the locale code to `i18n/routing.ts` (`locales`, and `rtlLocales` if
   it reads right-to-left).
2. Copy `messages/en.json` to `messages/<locale>.json` and translate every
   key. **Nothing currently type-checks the new file against `en.json`** --
   `global.d.ts` types `Messages` as `typeof en`, but no other locale file is
   validated against that type, so a key present in `en.json` but missing
   from, say, `ar.json` compiles fine and only fails silently at runtime
   (next-intl falls back or renders the raw key path). Diff the two files by
   hand, or add a script that does, before shipping a new key.

## Adding a uniform category

Add an entry to the `categories` array in `lib/content.ts` (id, icon key,
gradient), a matching icon case in `components/ui/CategoryIcon.tsx`, and a
`categories.<id>` block in every file under `messages/`.

## Contact-lead pipeline

The contact form (`components/sections/ContactForm.tsx`) posts to
`app/api/contact/route.ts`, which inserts into Supabase's `contact_leads`
table via the `submit_contact_lead` RPC (this also enforces rate limits --
see `supabase/migrations/20261007173246_rate_limit.sql`). From there:

- An `after insert` trigger fans the new lead out to every active
  `whatsapp_recipients` row and fires a low-latency push (via the
  `whatsapp-notify` Edge Function, which sends a WhatsApp template message
  per recipient); a `pg_cron` sweep every 15 minutes is the actual delivery
  guarantee, re-driving anything the trigger's fire-and-forget call never
  got a confirmed response for. Delivery is tracked per (lead, recipient)
  pair in `contact_lead_whatsapp_notifications`, so a retry only targets
  recipients who haven't received it yet.
- A `pg_cron` job at 05:00 UTC (09:00 UAE time) invokes `daily-leads-report`,
  which emails a spreadsheet of the previous business day's leads via
  SendGrid to every active `report_recipients` row, with an 11:00 UAE time
  conditional retry if the morning run didn't complete.

Both recipient lists (`whatsapp_recipients`, `report_recipients`) are
admin-managed directly in Supabase Studio's table editor -- there is no
in-app UI. Prefer setting `is_active = false` over deleting a row.

See `supabase/migrations/*.sql` (each file's header comment explains what it
does and why) and
`supabase/functions/{whatsapp-notify,daily-leads-report}/index.ts` for the
implementation. `supabase/functions/_shared/` holds the pure, unit-tested
logic (business-day boundary math, WhatsApp error classification, template
parameter sanitization, spreadsheet cell sanitization) -- run it with
`npm run test:functions`.

### WhatsApp setup (do this before anything sends)

A WhatsApp Business **template message is required** for every notification
here -- these are business-initiated messages to staff who haven't messaged
the business number first, and the Cloud API rejects free-text outside an
open 24-hour customer-service window. One-time setup in
[Meta Business Manager](https://business.facebook.com/):

1. Create (or reuse) a WhatsApp Business Account and a sending phone number;
   note its **Phone Number ID**.
2. Create a System User with the `whatsapp_business_messaging` permission
   and generate a **long-lived access token** for it (not the 24-hour token
   the quickstart page shows -- that expires and the pipeline will start
   failing with a 401 the next day).
3. Create a message template (WhatsApp Manager -> Account tools -> Message
   templates) with a **body containing exactly 4 placeholders, in this
   order**: `{{1}}` name, `{{2}}` email, `{{3}}` phone, `{{4}}` message --
   e.g. "New lead: {{1}} ({{2}}, {{3}}). Message: {{4}}". Submit it for
   approval; this can take minutes to a day. The function will reject every
   notification with error code 132001 until it's approved.
4. Set `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
   `WHATSAPP_TEMPLATE_NAME`, and `WHATSAPP_TEMPLATE_LANGUAGE` (matching the
   template's approved language) as function secrets.
5. Add at least one row to `whatsapp_recipients` (E.164 format, e.g.
   `+9715XXXXXXXX`) -- nothing is sent to anyone until a row exists.

### Environment variables

| Name | Lives in | Read by |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SECRET_KEY` | `.env.local` (never commit) | `lib/env.ts` |
| `CONTACT_IP_HASH_SALT` | `.env.local` | `lib/contact/rate-limit.ts` |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TEMPLATE_NAME` | Supabase function secrets | `whatsapp-notify` |
| `WHATSAPP_API_VERSION` (optional, default `v23.0`), `WHATSAPP_TEMPLATE_LANGUAGE` (optional, default `en_US`) | Supabase function secrets | `whatsapp-notify` |
| `WHATSAPP_RECIPIENT_OVERRIDE` (optional) | Supabase function secrets | `whatsapp-notify`, only when a request body sets `dry_run: true` |
| `SENDGRID_API_KEY`, `REPORT_FROM_EMAIL` | Supabase function secrets | `daily-leads-report` |
| `REPORT_RECIPIENT_OVERRIDE` (optional) | Supabase function secrets | `daily-leads-report`, only when a request body sets `dry_run: true` |
| Vault secrets `project_url`, `edge_function_secret_key` | Supabase Vault (`vault.create_secret(...)`, run once by hand -- never in a migration file) | `invoke_edge_function` |

Set function secrets with:

```bash
supabase secrets set --env-file supabase/functions/.env
```

The Supabase secret key exists in two places (`.env.local` for the Next
app, Vault for the database) -- rotating it means updating both.

### Runbook

**Re-drive a notification stuck at `dead`** (after fixing whatever caused
it -- e.g. a now-approved template, a corrected phone number, or a rotated
access token):

```sql
update public.contact_lead_whatsapp_notifications
   set status = 'pending', attempts = 0, next_attempt_at = now()
 where id = <notification id>;
```
The next sweep (within 15 minutes) will pick it up.

**Add or remove a WhatsApp recipient / report recipient**: insert, update,
or set `is_active = false` directly on `whatsapp_recipients` /
`report_recipients` in Studio's table editor.

**Re-send a day's report** (after fixing whatever caused the original send
to fail, or to regenerate one on request):

```sql
delete from public.report_runs where report_date = '<YYYY-MM-DD>';
```
then invoke the function directly:
```bash
curl -X POST 'https://<project-ref>.supabase.co/functions/v1/daily-leads-report' \
  -H 'apikey: <secret key>' -H 'Content-Type: application/json' \
  -d '{"report_date": "<YYYY-MM-DD>"}'
```

**Exercise either pipeline without contacting real people**: set
`REPORT_RECIPIENT_OVERRIDE` / `WHATSAPP_RECIPIENT_OVERRIDE` and invoke with
`{"dry_run": true, ...}` in the request body. Leaving the override env var
set does nothing by itself -- a request must explicitly ask for `dry_run`,
specifically so forgetting to unset it afterwards can't silently misroute
production traffic.

**Diagnostics** (a WhatsApp send failed and you need to know why --
`net._http_response` only retains 6 hours, so the row itself is usually the
only surviving record):

```sql
-- What actually happened to one lead's notifications
select recipient_id, status, attempts, last_error, sent_at
  from public.contact_lead_whatsapp_notifications where lead_id = <lead id>;

-- Is the sweep/report cron actually running?
select jobname, status, return_message, start_time
  from cron.job_run_details order by start_time desc limit 20;

-- How many notifications are currently stuck
select status, count(*) from public.contact_lead_whatsapp_notifications
 where status in ('pending', 'processing', 'failed') group by 1;

-- Every dead notification sharing the same error usually means the
-- template itself needs attention (see WhatsApp setup, step 3), not any
-- one recipient
select last_error, count(*) from public.contact_lead_whatsapp_notifications
 where status = 'dead' group by 1 order by 2 desc;
```

### Known limitations (accepted, not bugs)

- No external alert if the 09:00 UAE time cron itself stops firing (e.g. a
  paused Supabase project) -- the zero-lead email is the only heartbeat.
- Rows in `contact_leads` (and its notification history) are kept
  indefinitely (no retention/purge job) -- a deliberate decision; revisit if
  a formal retention policy is set.
- WhatsApp notifications are sent sequentially within one Edge Function
  invocation (see whatsapp-notify's own comment) -- fine at this project's
  expected volume, worth revisiting if the recipient list or lead volume
  grows substantially.
