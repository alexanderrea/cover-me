# COVER ME

Cover letters written from your actual resume, your LinkedIn profile, and live
web research on the company — not from a template.

Sign in with Google, add your own Anthropic API key, add your details once, then
paste a job link. It reads the posting, searches the web for what's worth knowing
about the company, and writes a letter you can tune with two sliders: **tone**
(reserved → bold) and **length** (≈130 → ≈450 words).

**Bring your own key.** Every letter is billed to the Anthropic key the signed-in
user added in Settings — never to whoever runs the server.

Brutalist, monospaced, mobile-first.

---

## Stack

| | |
|---|---|
| Framework | Next.js 15 (App Router) + React 19, TypeScript |
| Auth + data | Supabase — Google OAuth, Postgres, row level security |
| Writing + research | Claude Opus 5 with the server-side `web_search` / `web_fetch` tools, on each user's own key |
| Parsing | `unpdf` (PDF), `mammoth` (DOCX), hand-rolled HTML → text |
| Styling | Plain CSS, no framework |
| Hosting | Vercel |

---

## Setup

### 1. Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → Run.
   That creates the two tables, the RLS policies, and a trigger that gives every
   new sign-in a profile row.
3. **Authentication → Sign In / Providers → Google** → enable it. Supabase shows
   you a callback URL — you'll need it in the next step.
4. **Authentication → URL Configuration**:
   - Site URL: `http://localhost:3000` (and your real domain in production)
   - Redirect URLs: add `http://localhost:3000/auth/callback` and
     `https://your-domain.com/auth/callback`

### 2. Google OAuth

In the [Google Cloud console](https://console.cloud.google.com/apis/credentials):

1. Create an **OAuth 2.0 Client ID** of type *Web application*.
2. Authorised redirect URI: the callback URL Supabase gave you — it looks like
   `https://<project-ref>.supabase.co/auth/v1/callback`.
3. Paste the client ID and secret back into Supabase's Google provider settings.

### 3. Environment

```bash
cp .env.example .env.local
```

Fill in the values. `ENCRYPTION_KEY` is required — it encrypts each user's
stored Anthropic key at rest:

```bash
openssl rand -hex 32
```

`ANTHROPIC_API_KEY` is **not** used by the app; it only powers `npm run smoke`.
The app takes each user's key from Settings instead.

> Changing `ENCRYPTION_KEY` later makes every stored key undecryptable, and each
> user has to re-enter theirs. Set it once and keep it.

### 4. Run

```bash
npm install && npm run dev
```

---

## Checking it works

`npm run smoke` runs the research-then-write pipeline against a made-up candidate
and job posting, printing the research brief, its sources, and the streamed
letter. It needs only `ANTHROPIC_API_KEY` — no Supabase, no browser — so it's the
fastest way to confirm the Claude side is wired up. Costs a few cents per run.

`npm run typecheck` and `npm run build` cover the rest.

---

## How a letter gets made

0. **The user's key** is decrypted from `profiles.anthropic_key_cipher` and used
   for both calls below. No key, no letter — `/api/generate` returns 402.
1. **Ingest** (`app/api/ingest`) turns a URL or an uploaded file into plain text.
   For URLs it prefers the page's schema.org `JobPosting` data and falls back to
   stripping the HTML.
2. **Research** (`lib/research.ts`) hands the posting to Claude with the
   server-side web search and fetch tools and asks for a ≤250-word brief plus
   concrete angles. It resumes `pause_turn` up to four times, and returns `null`
   rather than throwing — a letter written from the posting alone is still a
   letter.
3. **Write** (`app/api/generate`) streams the letter back over SSE while the
   client renders it token by token, then saves it with its research and sources.

The prompts live in [`lib/prompt.ts`](lib/prompt.ts) — including the slider
bands and the ban list ("passionate about", "proven track record", "hit the
ground running"). That file is the main dial to turn if the letters don't sound
right.

---

## Where the API keys live

Each user's Anthropic key is encrypted with AES-256-GCM ([`lib/crypto.ts`](lib/crypto.ts))
before it touches the database, using `ENCRYPTION_KEY` from the environment. Two
independent layers protect it:

- **Row level security** stops one user reading another's row.
- **Encryption at rest** means a database leak yields nothing without
  `ENCRYPTION_KEY`, which never goes near Postgres.

The plaintext key is only ever held in memory, inside the request that uses it.
It is never returned to the browser — pages select `anthropic_key_hint`
(`sk-ant-…9f2a`) and deliberately never `anthropic_key_cipher`. Keys are verified
against Anthropic before being stored, so a bad paste fails in Settings rather
than mid-letter.

## Known limits

- **LinkedIn profiles can't be read automatically.** LinkedIn has no public API
  for profile data and blocks scraping, so `/profile` asks you to paste your
  profile text (or your LinkedIn data export) once. It's stored and reused.
- **Some job boards can't be read server-side.** LinkedIn, Indeed, Glassdoor,
  ZipRecruiter and Dice actively refuse; Ashby renders its postings in the
  browser, so the server sees an empty page. In every case the app says which
  problem it hit and points you at the paste box. Verified working: Greenhouse,
  Lever and ordinary company career pages.
- **Scanned PDFs** produce no text — there's no OCR step.
- **Old `.doc` files** aren't supported; save as `.docx` or PDF.
- Resume files are parsed to text and the text is stored; the original file is
  not kept.
- `npm audit` reports a moderate `postcss` advisory reached through Next 15.
  Clearing it means upgrading to Next 16, which is a breaking change — left
  alone deliberately.

---

## Deploying

Live at **https://cover-me-aux-works.vercel.app** (Vercel project
`aux-works/cover-me`, auto-deploying from `main`).

The project sits behind Vercel Deployment Protection, so you need to be signed
in to Vercel to reach it. Turn that off under **Project → Settings → Deployment
Protection** when you want it open.

`NEXT_PUBLIC_*` variables are inlined at build time, so **changing one needs a
redeploy** — setting it in the dashboard is not enough on its own.

Remember `ENCRYPTION_KEY` must be set in Vercel too, or saving a key fails.

After setting the Supabase variables, add the production URLs to Supabase's
**Authentication → URL Configuration**: the site URL, and
`https://cover-me-aux-works.vercel.app/auth/callback` as a redirect.

The generate route is configured for `maxDuration = 300`, which needs a Vercel
plan that allows long function durations; research plus writing usually takes
40–90 seconds.
