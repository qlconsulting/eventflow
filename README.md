# The Leverage Lab

Elite high-ticket SaaS platform: multi-tenant AI research, generation, and outreach for executives.

## Architecture

| Package | Role |
|---------|------|
| `cloudflare-worker/` | Secure API proxy, Teable router, Dashform onboarding, orchestration pipeline |
| `apps/plugthis-extension/` | PlugThis.ai MV3 extension (mock-first Worker client) |
| `chrome-extension/` | Earlier popup prototype (superseded by `apps/plugthis-extension` for PlugThis) |
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

### Teable prep (manifest ingested)

Source of truth: `config/teable-manifest.json` / `config/teable-ids.example.json`.

| Item | Value |
|------|-------|
| Master Control Base | `bsepxFqD62xkJPeEU8O` |
| Template folder (inside Master Control) | `bnfOKrLgZQSoxtvLXxf` |
| Separate template base | **none** — do not clone the whole Master Control base |
| Provisioning mode | `POST /api/base/duplicate` with `nodes=[templateFolderId]` |
| Still required | `TEABLE_API_KEY` in Cloudflare secrets (local `.dev.vars` only) |
| Space for client bases | `spcVj6FkI8DhUVqEOmu` (The Leverage Lab) — also in Global_System_Variables |

Client table IDs change on every provision — discover by table name after duplicate.

Dashform form shell: `nr0HMXaCSM` (questions still need MCP/UI completion). Webhook **not** enabled yet.

### Dashform MCP

Repo config: `.cursor/mcp.json` → `https://getaiform.com/api/mcp` (OAuth 2.1).

1. In **Cursor Desktop**: Settings → MCP → add Dashform and complete OAuth.
2. For **Cloud Agents**: ensure Dashform is allowed/authenticated for this environment.
3. After auth, finish intake questions from `config/dashform-leverage-lab-intake.json`.

## API surface (Worker)

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/onboarding` | Dashform webhook — clone Teable base, inject prompts, register client |
| `GET`  | `/api/prompts` | List prompt templates from the user's private Teable base (JWT) |
| `POST` | `/api/orchestrate` | Retriever → Katteb → Qolaba → Teable pipeline |
| `GET`  | `/api/health` | Liveness check |

## License

Proprietary — The Leverage Lab.
