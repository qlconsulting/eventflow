# The Leverage Lab

Elite high-ticket SaaS platform: multi-tenant AI research, generation, and outreach for executives.

## Architecture

| Package | Role |
|---------|------|
| `cloudflare-worker/` | Secure API proxy, Teable router, Dashform onboarding, orchestration pipeline |
| `chrome-extension/` | Manifest V3 extension — triggers research, generation, and outreach via JWT |
| `config/` | Deployment templates and env var examples (no secrets) |

### Security (non-negotiable)

The Chrome Extension **never** holds master API keys (Teable, Katteb, Qolaba, Retriever AI, Fuse, Pretty Prompt, Feedboss). It talks only to the Cloudflare Worker with a User JWT; the Worker injects keys server-side.

## Quick start

### Cloudflare Worker

```bash
cd cloudflare-worker
cp ../config/wrangler.example.toml ./wrangler.toml
cp ../config/.env.example .dev.vars
# Fill in secrets in .dev.vars and wrangler.toml [vars] / secrets
npm install
npm run dev
```

### Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `chrome-extension/`
4. Set the Worker base URL in extension storage (see popup)

## Environment

Copy `config/.env.example` to `cloudflare-worker/.dev.vars` for local Wrangler. Production secrets stay in Cloudflare dashboard / `wrangler secret put`. Never commit `.env`, `.dev.vars`, or `cloudflare-worker/wrangler.toml`.

### Teable prep (blocked on ID dump)

Paste Teable’s implementation reply into the next chat turn. Until then, keep placeholders in `config/teable-ids.example.json` and Wrangler `[vars]`:

| Need from Teable | Worker binding |
|------------------|----------------|
| Master Control Base ID | `TEABLE_MASTER_BASE_ID` |
| `[TEMPLATE] The Leverage Lab - Executive Workspace` Base ID | `TEABLE_TEMPLATE_BASE_ID` |
| `Executive_Directory` table ID | `TEABLE_EXECUTIVE_DIRECTORY_TABLE_ID` |
| `Provisioning_Log` / `Master_Prompt_Templates` / `Tone_Persona_Matrix` / `Global_System_Variables` | matching `TEABLE_*_TABLE_ID` vars |
| Template table IDs (schema reference) | `TEABLE_TMPL_*_TABLE_ID` |
| API constraints on base duplicate / links / attachments | documented in PR follow-up |

Dashform webhook is **not** enabled yet — `/api/onboarding` accepts the sample envelope for mapping/tests only.

### Dashform MCP

Repo config: `.cursor/mcp.json` → `https://getaiform.com/api/mcp` (OAuth 2.1).

1. In **Cursor Desktop**: Settings → MCP → add Dashform (or open the [install deeplink](cursor://anysphere.cursor-deeplink/mcp/install?name=dashform&config=eyJ1cmwiOiJodHRwczovL2dldGFpZm9ybS5jb20vYXBpL21jcCJ9)) and complete OAuth.
2. For **Cloud Agents**: ensure Dashform is allowed/authenticated for this environment; this run cannot call Dashform tools until that connection is live.
3. After auth, use MCP to create the Leverage Lab intake form and sync `DASHFORM_FORM_ID` — still do **not** wire the live webhook until Teable IDs are in.

## API surface (Worker)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/onboarding` | Dashform webhook — clone Teable base, inject prompts, register client |
| `GET`  | `/api/prompts` | List prompt templates from the user's private Teable base (JWT) |
| `POST` | `/api/orchestrate` | Retriever → Katteb → Qolaba → Teable pipeline |
| `GET`  | `/api/health` | Liveness check |

## License

Proprietary — The Leverage Lab.
