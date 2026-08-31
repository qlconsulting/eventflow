# Merge into qlconsulting/the-leverage-lab

This Cloud Agent **cannot create** `qlconsulting/the-leverage-lab` (GitHub App token lacks `createRepository` / org admin). Create the empty repo in GitHub, then run a **new** Cloud Agent on that repo and apply this export.

## Source of truth (today)

| Item | Value |
|------|-------|
| Export branch on eventflow | `cursor/init-leverage-lab-workspace-2f61` |
| PR (eventflow) | https://github.com/qlconsulting/eventflow/pull/1 |
| Bundle artifact | `the-leverage-lab.bundle` (commits `main..cursor/init-leverage-lab-workspace-2f61`) |

## Human step — create the empty repo

1. GitHub → org **qlconsulting** → **New repository**
2. Name: `the-leverage-lab`
3. Private (recommended), **no** README/license (empty)
4. Grant Cursor GitHub App access to the new repo
5. Start a **new Cloud Agent** with primary repo `github.com/qlconsulting/the-leverage-lab`

## New agent — import commands

```bash
# From the new empty the-leverage-lab worktree:
git remote add eventflow https://github.com/qlconsulting/eventflow.git
git fetch eventflow cursor/init-leverage-lab-workspace-2f61
git checkout -b main
git reset --hard eventflow/cursor/init-leverage-lab-workspace-2f61
# Or merge onto whatever default branch exists:
# git merge --allow-unrelated-histories eventflow/cursor/init-leverage-lab-workspace-2f61

git push -u origin HEAD:main
```

### Alternative — apply bundle

If the bundle file is available in the new environment:

```bash
git clone https://github.com/qlconsulting/the-leverage-lab.git
cd the-leverage-lab
git fetch /path/to/the-leverage-lab.bundle cursor/init-leverage-lab-workspace-2f61:import/leverage-lab
git checkout -B main import/leverage-lab
git push -u origin main
```

## What this export contains

- `cloudflare-worker/` — Worker scaffold + Teable/Dashform contracts
- `apps/plugthis-extension/` — PlugThis MV3 mock-first extension
- `chrome-extension/` — earlier prototype
- `config/` — Teable manifest, Dashform maps, env examples
- `docs/` — integration plans, pre-webhook blockers, this merge guide
- `.cursorrules`, `.cursor/mcp.json`

Secrets stay out of git (`.dev.vars` gitignored). Re-add `TEABLE_API_KEY` / `DASHFORM_API_KEY` in the new environment only.
