# Dashform Integration Plan — The Leverage Lab

**Status:** Discovery / planning only  
**Date:** 2026-08-31  
**Scope:** Safe MCP reachability + read-only form discovery. No Dashform edits, publishes, deletes, webhook activation, or Cloudflare Worker automation in this pass.

---

## 1. MCP connection status

| Check | Result |
|-------|--------|
| Endpoint | `https://getaiform.com/api/mcp` |
| Transport | Streamable HTTP |
| Host reachable | **Yes** (HTTP 401 with MCP JSON-RPC error body, not network failure) |
| Auth without token | `missing authorization header` |
| Auth with Dashform API key (`X-API-Key` / Bearer `df_…`) | **Fails** — `no token payload` (MCP expects OAuth JWT, not API key) |
| Cursor Cloud Agent MCP namespace `dashform` | **Not attached** to this run (no tools in agent tool catalog) |
| Repo MCP config | `.cursor/mcp.json` points at the endpoint |
| OAuth | OAuth 2.1 authorization_code; resource metadata at `https://getaiform.com/.well-known/oauth-protected-resource/api/mcp`; authorization server `https://getaiform.com/api/auth`; scope `mcp` |

**Verdict:** MCP server is reachable but **not authenticated** in this Cloud Agent session. Full form question / webhook inspection via MCP tools is blocked until Cursor Desktop/Cloud completes OAuth for Dashform.

**Fallback used for planning (read-only):** Dashform REST `GET /api/v1/forms` with `X-API-Key` listed account forms and metadata only. REST `GET /api/v1/forms/{id}` does **not** return questions, answer keys, or webhook config.

---

## 2. Discovered Dashform capabilities

### 2.1 Public discovery tools (from `/.well-known/mcp.json`)

These are advertised as MCP tools (merchant / booking oriented; may be public or lightly gated):

| Tool | Description |
|------|-------------|
| `list_categories` | Browse service categories with merchant counts |
| `search_merchants` | Search merchants by keyword, category, or location |
| `search_services` | Search services across merchants with price filtering |
| `get_business_info` | Detailed business profile for a merchant |
| `get_services` | List services for a merchant |
| `get_form_questions` | List intake questions for a merchant form |
| `check_fit` | AI lead qualification against merchant criteria |
| `book_appointment` | Submit a qualified lead / book appointment |

### 2.2 Authenticated capabilities (manifest — require OAuth)

Per Dashform MCP manifest `authenticatedCapabilities` (not exercised here):

- **Account:** identity, organizations, switch active org  
- **Forms:** list / get / create / update / delete, publish, versions, scoring criteria  
- **Form editing:** conversational `chat_form_editor`  
- **Replies:** list / get / delete, verdicts, rescore, insights, analytics chat  
- **Integrations:** native connections, integrations, events, provider lookups  
- **Zapier:** list / toggle / delete hooks  
- **Organization:** branding, email config, custom domains  
- **Media:** Pexels search, blob upload/delete, transcribe, prompt refine, agent-profile import  

**Important for Leverage Lab:** Form CRUD, reply inspection, and Zapier/hook management appear under **authenticated** MCP capabilities — exactly what we need for intake planning after OAuth.

---

## 3. Available forms / funnels (REST read-only)

Account forms visible via `GET /api/v1/forms` (metadata only):

| Name | `public_id` | UUID | Relevance |
|------|-------------|------|-----------|
| **The Leverage Lab — Executive Intake** | `nr0HMXaCSM` | `5d3e962a-bc3a-41c3-b88b-afbfb45aab78` | **Primary candidate** (name match: Leverage + Executive + Intake) |
| Executive Coaching — Client Intake | `cmEuEfkVkx` | `2c9fa66b-ad77-423a-a4bb-7f33937b5efc` | Related “intake” but coaching-specific; not Leverage Lab |
| Create A Coaching Intake Form | `CCxbpWgrL8` | `b5a2cbab-3f48-4787-a751-bdb60154b6b7` | Generic coaching intake; not Leverage Lab |
| Creat An Invoice | `KgdHkHrIkl` | `bd9add81-e1b7-47fa-9a9f-c0f4396b0ce7` | Unrelated |

No form named exactly “Quintin Lee client onboarding” was found.

### Recommended intake form (provisional)

- **Recommended ID (public):** `nr0HMXaCSM`  
- **Recommended UUID:** `5d3e962a-bc3a-41c3-b88b-afbfb45aab78`  
- **Name:** The Leverage Lab — Executive Intake  
- **Confidence:** High for *naming*, **Low** for *live question keys* — REST does not return questions; MCP OAuth not available to call authenticated `get` / form detail tools.  
- **Share URL hint (unconfirmed published state):** `https://getaiform.com/f/nr0HMXaCSM` (public GET returned 404 earlier → likely unpublished / incomplete).

**Planned question keys** (from local planning artifact `config/dashform-leverage-lab-intake.json` — **unconfirmed against live Dashform until MCP/UI verifies**):

`exec_name`, `exec_email`, `company_name`, `company_website`, `executive_linkedin`, `target_audience`, `core_offer`, `brand_tone`, `primary_pain_point`, `preferred_channels`, `web_management_client`, `managed_domain`, `web_management_scope`, `brand_voice_notes`, `client_package`

---

## 4. Expected payload format (planning target — unconfirmed)

Until Dashform MCP or a sample webhook delivery confirms the live envelope, treat this as the **target** shape (not verified):

```json
{
  "event": "form.submitted",
  "form_id": "frm_leverage_lab_intake",
  "submission_id": "sub_example_001",
  "submitted_at": "2026-01-01T18:30:00Z",
  "answers": {
    "exec_name": "Sample Executive",
    "exec_email": "executive@example.com",
    "company_name": "Example Company",
    "company_website": "https://example.com",
    "executive_linkedin": "https://linkedin.com/in/example",
    "target_audience": "High-value B2B decision makers",
    "core_offer": "Managed web presence, monitoring, security, and AI-powered authority building",
    "brand_tone": "Direct/Opinionated",
    "primary_pain_point": "turning online visibility into trusted business opportunities",
    "preferred_channels": ["LinkedIn", "Email", "Blog"],
    "web_management_client": true,
    "managed_domain": "https://example.com",
    "web_management_scope": [
      "Website Management",
      "Security Monitoring",
      "Uptime Monitoring",
      "Backups"
    ]
  }
}
```

### Known / likely mismatches vs live Dashform

| Planning assumption | Live discovery note | Status |
|---------------------|---------------------|--------|
| `form_id`: `frm_leverage_lab_intake` | Live `public_id` is `nr0HMXaCSM` (UUID also exists) | **Mismatch — unconfirmed which ID webhooks emit** |
| `event`: `form.submitted` | Not observed in docs HTML or live payload | **Unconfirmed** |
| `answers.*` keys as above | Not returned by REST GET; MCP not authenticated | **Unconfirmed** |
| `web_management_client`: boolean | Planned form uses Yes/No single-choice in local schema | **Possible type mismatch** |
| `preferred_channels` / `web_management_scope`: arrays | Planned as multiple-choice | **Unconfirmed serialization** |
| Webhook secret header vs body field | Not discoverable without authenticated integrations/hooks tools | **Unconfirmed** |

See `config/dashform-field-map.example.json` for Teable field targets and aliases.

---

## 5. Webhook setup requirements (not configured)

**Do not activate yet.** Planning requirements only:

1. **Complete / publish** the Leverage Lab intake form with stable answer keys matching the field map.  
2. **Authenticate Dashform MCP (OAuth)** and inspect:
   - form questions + keys  
   - Zapier / native hook options (`authenticatedCapabilities` lists Zapier hook list/toggle/delete)  
   - sample reply / webhook payload if available  
3. **Destination URL (future):** Worker `POST /api/onboarding` on the future API host (e.g. `https://api.theleveragelab.com/api/onboarding`) — **not deployed in this task**.  
4. **Shared secret:** Worker should verify `X-Webhook-Secret` / `X-Dashform-Secret` or body secret; store only in Cloudflare secrets — never in Teable.  
5. **Idempotency:** key off `submission_id` + executive email before provisioning.  
6. **No live webhook** until Teable Master Control + Executive Workspace template IDs and clone/provision rules are finalized.

REST probes for `/api/v1/webhooks`, `/api/v1/integrations`, and per-form hooks returned 404 or unauthorized — webhook management likely MCP-authenticated or UI-only.

---

## 6. Authentication requirements

| Surface | Auth | Notes |
|---------|------|------|
| Dashform MCP | **OAuth 2.1** (authorization_code, scope `mcp`) | Required for form detail, replies, integrations/Zapier tools |
| Dashform REST `/api/v1/*` | **`X-API-Key: df_…`** | Lists forms + metadata; insufficient for questions/webhooks in current API surface |
| Future Worker ← Dashform webhook | Shared webhook secret (header or body) | Not configured |
| Future Worker → Teable | Teable PAT / API key in Cloudflare secrets | Teable prep still in progress — **do not hardcode Base IDs in automation yet** |

---

## 7. Risks and unknowns

1. **MCP OAuth not connected** in this Cloud Agent → cannot verify live question keys or webhook payload.  
2. **REST cannot return form questions** → risk that the Leverage Lab form shell has incomplete questions despite matching name.  
3. **`form_id` identity ambiguity** (`frm_…` vs `public_id` vs UUID) will break routing if assumed wrong.  
4. **Boolean vs Yes/No** for `web_management_client` may need coercion.  
5. **Select option strings** for `brand_tone` / packages must match Teable single-select choices exactly (typecast failures otherwise).  
6. **Teable template base still being prepared** — Worker automation and Base ID hardcoding deferred by design.  
7. **Zapier vs native webhook** path unknown until authenticated MCP integration tools are inspected.  
8. Publishing / share URL 404 suggests the recommended form may not be live for respondents yet.

---

## 8. What we need from Teable before coding begins

Do **not** start Cloudflare Worker automation or hardcode Teable Base IDs until Teable returns a complete implementation dump:

1. Master Control Base ID  
2. Template Executive Workspace Base ID **or** confirmed folder-scoped clone strategy + Space ID  
3. All Master Control table IDs (at minimum `Executive_Directory`, `Provisioning_Log`, `Master_Prompt_Templates`, `Tone_Persona_Matrix`, `Global_System_Variables`)  
4. All Template table IDs (especially `Client_Profile`, `Prompt_Library`, `Web_Properties`, …)  
5. Field IDs if available; confirm email/URL field types  
6. Deviations from requested schema  
7. API constraints for base duplicate / table copy, link writes, attachments, `typecast`  
8. Confirmation that seeded prompt templates + tone personas exist  

**Parallel Dashform unlock:** complete Cursor OAuth for Dashform MCP, then re-run read-only discovery to confirm question keys and webhook payload before any Worker webhook handler is activated.

---

## 9. Artifacts

| File | Purpose |
|------|---------|
| `docs/dashform-integration-plan.md` | This plan |
| `config/dashform-field-map.example.json` | Planned answer key → Teable field map (unconfirmed) |
| `config/dashform-leverage-lab-intake.json` | Local planned form schema (not verified live) |
| `.cursor/mcp.json` | Dashform MCP endpoint registration |

**Explicit non-actions this pass:** no Dashform edits/publishes/deletes; no live webhooks; no new Cloudflare Worker automation; no Teable Base ID hardcoding for implementation.
