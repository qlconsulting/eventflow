# Pre-webhook blockers

Last updated: 2026-08-31

## Confirmed

| Item | Value |
|------|-------|
| Teable Space ID | `spcVj6FkI8DhUVqEOmu` (The Leverage Lab) |
| GSV `TEABLE_SPACE_ID` | Updated (user + agent seed) |
| Master Control Base | `bsepxFqD62xkJPeEU8O` |
| Template folder | `bnfOKrLgZQSoxtvLXxf` |
| Dashform intake candidate | `nr0HMXaCSM` / `5d3e962a-bc3a-41c3-b88b-afbfb45aab78` |
| Local `TEABLE_API_KEY` | Present in gitignored `cloudflare-worker/.dev.vars` only |

**Webhook remains OFF.**

---

## Blocker 1 — Store `TEABLE_API_KEY` in Cloudflare Worker secrets

Cloud Agent Wrangler status: **not authenticated** (`wrangler whoami` → not logged in). Cannot run `secret put` from this environment yet.

### Option A — Local / authenticated machine

```bash
cd cloudflare-worker
cp ../config/wrangler.example.toml ./wrangler.toml   # if needed
npx wrangler login
# Non-interactive secret upload:
printf '%s' "$TEABLE_API_KEY" | npx wrangler secret put TEABLE_API_KEY
```

Also put (when ready, still before webhook):

```bash
printf '%s' "$JWT_SECRET" | npx wrangler secret put JWT_SECRET
printf '%s' "$DASHFORM_WEBHOOK_SECRET" | npx wrangler secret put DASHFORM_WEBHOOK_SECRET
# later: RETRIEVER_API_KEY, KATTEB_API_KEY, QOLABA_API_KEY, FUSE_API_KEY, DASHFORM_API_KEY
```

Ensure `[vars]` includes `TEABLE_SPACE_ID = "spcVj6FkI8DhUVqEOmu"` (already in `config/wrangler.example.toml`).

### Option B — Give Cloud Agent a Cloudflare API token

Add `CLOUDFLARE_API_TOKEN` (Workers edit) to agent secrets, then ask the agent to run `wrangler secret put TEABLE_API_KEY`.

---

## Blocker 2 — Finalize / verify Dashform form `nr0HMXaCSM`

| Check | Result |
|-------|--------|
| Form shell exists | Yes — name/metadata via REST |
| Questions readable via REST | **No** — GET returns metadata only |
| Questions writable via REST PATCH | **No evidence they persist** — PATCH accepts body but does not return questions; share URL `https://getaiform.com/f/nr0HMXaCSM` still **404** |
| Dashform MCP in this agent | **Not authenticated** (OAuth required; API key rejected by MCP) |

### Required human / OAuth step

1. Open form editor: `https://getaiform.com/forms/5d3e962a-bc3a-41c3-b88b-afbfb45aab78` (or Dashform dashboard).  
2. Apply questions from `config/dashform-leverage-lab-intake.json` using these **answer keys**:

   `exec_name`, `exec_email`, `company_name`, `company_website`, `executive_linkedin`, `target_audience`, `core_offer`, `brand_tone`, `primary_pain_point`, `preferred_channels`, `web_management_client`, `managed_domain`, `web_management_scope`, `brand_voice_notes`, `client_package`

3. Publish so `https://getaiform.com/f/nr0HMXaCSM` loads.  
4. Capture one **test submission** and paste the raw webhook/reply JSON (or confirm keys via Dashform MCP after OAuth).  
5. Update `config/dashform-field-map.example.json` statuses from `unconfirmed` → `verified`.

Until then, treat all payload keys as **unconfirmed**. Do **not** enable the Cloudflare `/api/onboarding` webhook.

---

## Ready when both blockers clear

1. `wrangler secret put TEABLE_API_KEY` succeeded for the Worker.  
2. Form `nr0HMXaCSM` published with verified keys + sample payload.  
3. Then: set `DASHFORM_WEBHOOK_SECRET`, point Dashform hook at Worker `/api/onboarding`, smoke-test one submission.
