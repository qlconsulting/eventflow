# Repository connection — the-leverage-lab

**Target:** https://github.com/qlconsulting/the-leverage-lab.git  
**Current agent origin:** `qlconsulting/eventflow` (only repo in Cloud Agent token scope)

## Blocker

`git ls-remote` / GitHub API return **404 Not Found** for `qlconsulting/the-leverage-lab`.
This environment’s `repos` list is only:

- `github.com/qlconsulting/eventflow`

## Once access is granted

```bash
# Option A — retarget origin
git remote set-url origin https://github.com/qlconsulting/the-leverage-lab.git
git push -u origin cursor/init-leverage-lab-workspace-2f61
git push -u origin main   # if seeding main from this worktree

# Option B — use the prepared remote name
git push -u leverage-lab cursor/init-leverage-lab-workspace-2f61
```

Then open/update the PR against `the-leverage-lab` (not eventflow).

## Local note

A remote named `leverage-lab` has been added in this worktree pointing at the target URL.
