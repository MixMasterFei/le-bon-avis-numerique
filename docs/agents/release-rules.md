# Release rules for `main` — proposal

**Status:** proposal from the Guardian, 7 Nov 2026. **Nothing has been changed in the
repository settings.** Xavier decides; the Director applies it once he says yes.

## Why

`main` has no branch protection and no ruleset. Anyone with write access — including an
agent's token — can push to it directly, force-push it or delete it, and a red check does not
stop a merge. Vercel deploys production from `main`, so an unreviewed push *is* a production
deploy. The house rules (« one mission = one branch = one PR », « only Xavier merges ») exist
today only on paper.

## The proposal: one ruleset on `main`

Use a repository **ruleset** (Settings → Rules → Rulesets), not classic branch protection: it
has an explicit bypass list and a bypass log. The repository is public, so rulesets are
available on the free plan.

| Rule | Setting | Why |
|---|---|---|
| Restrict deletions | on | `main` can't disappear by mistake. |
| Block force pushes | on | History that production was built from stays intact. |
| Require a pull request before merging | on, **0 approvals** | Every change arrives as a PR with its checks and a trace. 0 approvals because GitHub doesn't let an author approve their own PR, and the PRs are opened under Xavier's account: 1 approval would block every merge. |
| Require status checks to pass | on, see below | A red check blocks the merge. |
| Require branches to be up to date | off for now | Turning it on re-runs CI on every open PR after each merge; the Director's release test-merge already covers this. Revisit if a merge breaks `main`. |
| Linear history | off | The repo merges with merge commits (« Merge #108 … »). |

### Checks to require now — only the reliable ones

| Check (exact name, as it appears on a PR) | Workflow | Why it qualifies |
|---|---|---|
| `Lint, Type Check & Build` | CI | Lint, `tsc`, the unit tests and `next build`. Green on every PR run since September 2026. |
| `Family fit + recommendations + age vote (Playwright)` | E2E — Family fit | Its own Postgres container, seeded data, no third party. 15 of the last 15 runs green. |

Pin both to the GitHub Actions app (`integration_id` 15368) so no other app can satisfy them.

### Checks that stay informative (not required)

- **`Performance budgets`** (Lighthouse CI). One desktop run per URL: LCP fails on slow
  runners. Red on 2 of the last 8 PR runs while CI was green — #107 measured a runner ~43 %
  slower (benchmarkIndex 1 733 vs 3 032) with identical server time, FCP and weight. Make it
  required only after it is stable: several runs per URL with the median asserted, and a
  couple of weeks without a false red.
- **The Vercel preview status.** Useful, but it depends on Vercel and on third parties at
  build time (the 6 Nov preview failed while downloading a Google font).
- **Production-only workflows** — Daily Filter Tests, News smoke, Prod health smoke,
  Dependency audit. They don't run on pull requests, so requiring them would leave every PR
  « waiting for status » forever. They watch production after the fact; their failures are
  the Director's to triage the same day.

### Emergency bypass

Bypass list: the **Repository admin** role (Xavier) only, mode « Always ». It lets Xavier push
a hotfix or merge past a red/blocked check when production is down or a check is broken.
Agents and the Claude GitHub App are **not** on the list: an agent always goes through a PR.
Every bypass appears in the ruleset's bypass log; the Director notes it in the next release
summary, and a hotfix pushed directly gets a follow-up PR with its test.

## How the Director applies it (after Xavier's go)

1. Merge the branch that moves CI to Node 24 first, and copy the two check names from a PR
   run of it — a required name that doesn't match exactly blocks every PR.
2. Create the ruleset in the UI (Settings → Rules → Rulesets → New branch ruleset, target
   « Default branch ») or with `gh api -X POST repos/MixMasterFei/le-bon-avis-numerique/rulesets --input ruleset.json`:

   ```json
   {
     "name": "Protect main",
     "target": "branch",
     "enforcement": "active",
     "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
     "bypass_actors": [
       { "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }
     ],
     "rules": [
       { "type": "deletion" },
       { "type": "non_fast_forward" },
       {
         "type": "pull_request",
         "parameters": {
           "required_approving_review_count": 0,
           "dismiss_stale_reviews_on_push": false,
           "require_code_owner_review": false,
           "require_last_push_approval": false,
           "required_review_thread_resolution": false
         }
       },
       {
         "type": "required_status_checks",
         "parameters": {
           "strict_required_status_checks_policy": false,
           "required_status_checks": [
             { "context": "Lint, Type Check & Build", "integration_id": 15368 },
             { "context": "Family fit + recommendations + age vote (Playwright)", "integration_id": 15368 }
           ]
         }
       }
     ]
   }
   ```

   (`actor_id` 5 is the Repository admin role; check the bypass list reads « Repository
   admin » once created.)
3. Verify on a throwaway PR: the merge button stays blocked until both checks are green, and
   a direct `git push` to `main` from a non-admin token is refused.
4. Write the date and the ruleset link in `guardian.md` « Open work ». To roll back: set the
   ruleset to « Disabled » — nothing else changes.
