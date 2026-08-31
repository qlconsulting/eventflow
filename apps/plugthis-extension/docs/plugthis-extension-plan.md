# PlugThis.ai / The Leverage Lab — Extension Plan

**Phase:** Mock-first Chrome MV3 scaffold  
**Package:** `apps/plugthis-extension/`  
**Worker placeholder:** `https://api.theleveragelab.com`  
**Status:** Local development only — not published, not connected to production Teable

---

## Purpose

PlugThis.ai is the executive browser companion for **The Leverage Lab**. From any tab, an executive can:

1. Capture a lead from the current page  
2. Trigger research  
3. Draft LinkedIn / email outreach copy  
4. Log a web insight  

The extension is a **thin client**. All privileged work (Teable, Retriever, Katteb, Qolaba, Fuse, license → Assigned Base ID mapping) happens in the **Cloudflare Worker**.

---

## Architecture

```
Page (content script)
   └─ sanitized PageCapturePayload
        └─ service worker
             └─ apiClient → Cloudflare Worker only
                  └─ (future) Teable / AI vendors via Worker secrets
```

**Hard rules**

- Extension never calls Teable, Dashform, Katteb, Retriever, Qolaba, Fuse, or other private APIs  
- Extension never stores Teable tokens, AI vendor keys, or Worker master secrets  
- No Teable field IDs hardcoded in extension production code  
- No live Teable record-writing or base-cloning from the extension (or from this phase’s Worker wiring)

---

## User flow

1. Install unpacked `dist/` (after `npm run build`) in `chrome://extensions`  
2. Open **Options** → set Worker URL (default placeholder), license key, executive email; leave **Mock Mode** on  
3. Browse to a prospect page → open popup  
4. Click an action → content script captures page → service worker posts to Worker **or** returns mock fixtures  
5. Status area shows success / error (mock responses are tagged)

---

## Current mock-mode limitations

| Area | Limitation |
|------|------------|
| Worker | Not required; mock fixtures used when `mockMode=true` or Worker unreachable |
| Teable | No writes; `assigned_base_id` remains null in mock validation |
| AI drafts | Placeholder LinkedIn / email text only |
| Research | Static mock summary |
| License | Mock validation always succeeds when mock mode is on |
| Template base | Standalone clone-safe Executive Workspace Template Base **not ready** — blocked |

---

## Future Worker endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/extension/validate` | License + executive → tenant / Assigned Base ID |
| `POST` | `/api/leads/capture` | Inbox lead from page capture |
| `POST` | `/api/research/run` | Research loop |
| `POST` | `/api/content/linkedin-post` | Thought leadership draft |
| `POST` | `/api/content/email-hook` | Outreach hook draft |
| `POST` | `/api/web/insight` | Web property / insight note |
| `POST` | `/api/logs/automation` | Client Automation_Log (+ credit ledger later) |

Headers (no master secrets):

- `Content-Type: application/json`  
- `x-extension-license`  
- `x-executive-email` (when available)

See `docs/extension-api-contracts.md` for payload types and Teable mapping notes.

---

## Required Teable IDs still pending

Do **not** hardcode into the extension. Worker will consume these later:

1. **Standalone clone-safe Executive Workspace Template Base ID** (critical blocker — folder-inside-Master-Control is not production-safe for full-base clone)  
2. Confirmed Space ID for client bases (operational: `spcVj6FkI8DhUVqEOmu` in Master Control GSV — Worker-side only)  
3. Per-client table ID discovery strategy after provision (by table **name**, not extension-hardcoded IDs)  
4. Field-level contracts for Inbox_Leads, Research_Runs, Thought_Leadership, Outreach_Queue, Web_Properties, Automation_Log, API_Credit_Ledger  

Until the **standalone Template Executive Workspace Base** exists, do not build live Teable write/clone automation for extension actions.

---

## Required Dashform fields still pending

Intake form candidate `nr0HMXaCSM` still needs published/verified question keys (see `docs/pre-webhook-blockers.md` / `docs/dashform-integration-plan.md`). Extension does **not** call Dashform; onboarding remains a separate Worker webhook path.

---

## Security model

| Layer | Responsibility |
|-------|----------------|
| Extension | Page sanitize, license header, executive email header, mock/live toggle |
| Worker | Validate license, resolve Assigned Base ID, inject vendor keys, Teable writes |
| Teable | Tenant data isolation in per-client bases |
| Chrome storage | Worker URL, license key string, email, tenant id, flags only |

Graceful failure: invalid license → 401/403 from Worker → popup shows error; mock mode bypasses live validation for local UX.

---

## Publishing checklist (future — not now)

- [ ] Standalone Template Executive Workspace Base ID delivered  
- [ ] Worker endpoints live + authenticated  
- [ ] License issuance flow  
- [ ] Mock mode default off for production builds  
- [ ] Icons / store listing assets  
- [ ] Privacy policy (page capture scope)  
- [ ] Chrome Web Store submission  

**Do not deploy or publish in this phase.**

---

## Load unpacked (local)

```bash
cd apps/plugthis-extension
npm install
npm run build
# chrome://extensions → Developer mode → Load unpacked → select apps/plugthis-extension/dist
```
