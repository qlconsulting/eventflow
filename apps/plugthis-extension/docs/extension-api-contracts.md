# Extension ↔ Worker API contracts

Typed source of truth: `src/types/extensionContracts.ts`.

The extension speaks **only** to the Cloudflare Worker (`https://api.theleveragelab.com` placeholder).  
The Worker later maps actions to Teable. **No Teable field IDs belong in the extension.**

---

## Security

- No direct Teable / Dashform / Katteb / Retriever / Qolaba / Fuse calls from the extension  
- No vendor API keys in the extension  
- Worker validates `x-extension-license` and maps executive email/license → Assigned Base ID  
- Worker holds all Teable + AI secrets  
- Invalid license → Worker `401/403` → extension surfaces error (mock mode skips live validation)

---

## Headers

| Header | Required | Notes |
|--------|----------|-------|
| `Content-Type` | yes | `application/json` |
| `x-extension-license` | live mode | Extension license key from Options |
| `x-executive-email` | when set | From Options |

---

## `PageCapturePayload`

```json
{
  "source": "plugthis_extension",
  "captured_at": "ISO timestamp",
  "page": {
    "title": "string",
    "url": "string",
    "canonical_url": "string | null",
    "meta_description": "string | null",
    "h1": "string | null",
    "selected_text": "string | null",
    "visible_text_excerpt": "string"
  },
  "executive_context": {
    "executive_email": "string | null",
    "tenant_id": "string | null"
  }
}
```

Optional extension field (sanitized): `page.linkedin_url`.

Visible text is capped and skips passwords, payment-like fields, hidden inputs, and non-visible nodes.

---

## Endpoints

### `POST /api/extension/validate`

**Request:** `ExtensionValidationRequest`  
**Response:** `ExtensionValidationResponse` (`valid`, optional `assigned_base_id`, `message`)

Worker responsibilities: verify license, resolve tenant / Assigned Base ID. Extension never stores Base IDs as source of truth beyond display.

### `POST /api/leads/capture`

**Request:** `LeadCaptureRequest` `{ capture, options? }`  
**Response:** `LeadCaptureResponse`

### `POST /api/research/run`

**Request:** `ResearchRunRequest`  
**Response:** `ResearchRunResponse`

### `POST /api/content/linkedin-post`

**Request:** `ContentDraftRequest` (`kind: linkedin_post`)  
**Response:** `ContentDraftResponse`

### `POST /api/content/email-hook`

**Request:** `ContentDraftRequest` (`kind: email_hook`)  
**Response:** `ContentDraftResponse`

### `POST /api/web/insight`

**Request:** `WebInsightRequest`  
**Response:** `WebInsightResponse`

### `POST /api/logs/automation`

**Request:** `AutomationLogRequest`  
**Response:** `AutomationLogResponse`

---

## Future Teable mapping (Worker-side only)

Do **not** implement live writes until the **standalone clone-safe Executive Workspace Template Base** exists.

### Capture Lead

| Destination | Table |
|-------------|-------|
| Client workspace | `Inbox_Leads` |
| Client workspace | `Research_Runs` (optional linked run) |
| Client workspace | `Automation_Log` |
| Master Control | `API_Credit_Ledger` |

### Run Research

| Destination | Table |
|-------------|-------|
| Client workspace | `Research_Runs` |
| Client workspace | `Inbox_Leads` (enrichment update) |
| Client workspace | `Automation_Log` |
| Master Control | `API_Credit_Ledger` |

### Draft LinkedIn Post

| Destination | Table |
|-------------|-------|
| Client workspace | `Thought_Leadership` |
| Client workspace | `Automation_Log` |
| Master Control | `API_Credit_Ledger` |

### Draft Email Hook

| Destination | Table |
|-------------|-------|
| Client workspace | `Outreach_Queue` |
| Client workspace | `Automation_Log` |
| Master Control | `API_Credit_Ledger` |

### Log Web Insight

| Destination | Table |
|-------------|-------|
| Client workspace | `Web_Properties` |
| Client workspace | `Automation_Log` |

---

## Mock fixtures

- `src/mock/samplePageCapture.json`  
- `src/mock/sampleLeadCaptureResponse.json`  

When `mockMode` is true (default) or the Worker is unreachable in debug flows, the client returns fixtures and tags `mock: true`.

---

## Blocked on Teable

1. Standalone Template Executive Workspace Base ID  
2. Production-safe provision path (no full Master Control clone)  
3. Stable post-provision table discovery by name  

Until then: extension scaffold + contracts + mock UX only.
