# Build And Deploy Pipeline

## Purpose

This pipeline keeps three concerns separate:

1. Production deploys from `main`
2. Preview deploys from pull requests into `main`
3. Validation-only CI for branch work such as `ca1/*`, `feat/*`, and `fix/*`

The split avoids burning Azure Static Web Apps preview slots for every working branch while still enforcing the same install, test, and build checks everywhere that matters.

## Workflow Overview

The GitHub Actions workflow lives at `.github/workflows/deploy.yml`.

It has three execution paths:

1. `build_and_deploy`
2. `ci_only`
3. `close_pull_request`

### 1. `build_and_deploy`

This job runs for:

- `push` to `main`
- `pull_request` events targeting `main` when the PR action is `opened`, `synchronize`, or `reopened`

The step order is intentional:

1. Checkout
2. Set up Node 22
3. Set up pnpm
4. Install dependencies
5. `Tests (gate)`
6. `Build`
7. Azure Static Web Apps deploy

The test gate sits before the build step so a failing test run stops the pipeline before artifacts are created or deployed.

### 2. `ci_only`

This job runs for branch pushes only:

- `ca1/**`
- `feat/**`
- `fix/**`

It performs:

1. Checkout
2. Node 22 setup
3. pnpm setup
4. Dependency install
5. `Tests (gate)`
6. `Build`

It does not deploy anything.

That branch isolation matters for multi-agent work:

- each CA1 branch gets the same validation as production code
- no Azure preview slot is consumed
- no shared deployment token collision occurs
- parallel branch pushes stay independent

### 3. `close_pull_request`

This job runs only when a pull request into `main` is closed.

Its only job is to tell Azure Static Web Apps to close the corresponding preview environment.

## Build Number Stamp Flow

The build metadata flow is centered on `scripts/stamp-build-info.mjs`.

### What the script computes

The script calculates four values:

- `NEXT_PUBLIC_BUILD_NUMBER`
- `NEXT_PUBLIC_COMMIT_SHA`
- `NEXT_PUBLIC_BUILD_TIME`
- `NEXT_PUBLIC_BRANCH`

Resolution order:

1. `buildNumber`

- use `GITHUB_RUN_NUMBER` in CI when present
- otherwise use `git rev-list --count HEAD`
- otherwise fall back to `0`

2. `commitSha`

- use `GITHUB_SHA` in CI when present
- otherwise use `git rev-parse HEAD`
- otherwise fall back to forty zeroes

3. `builtAt`

- use `new Date().toISOString()` at stamp time

4. `branch`

- use `GITHUB_REF_NAME` in CI when present
- otherwise use `git rev-parse --abbrev-ref HEAD`
- otherwise fall back to `unknown`

### What the script writes

The script writes `.env.production.local` at the repository root when run from the repo root, which is how `pnpm build` invokes it.

That file is intentionally gitignored.

The resulting file looks like:

```dotenv
NEXT_PUBLIC_BUILD_NUMBER=123
NEXT_PUBLIC_COMMIT_SHA=abcdef1234567890abcdef1234567890abcdef12
NEXT_PUBLIC_BUILD_TIME=2026-04-28T18:05:12.345Z
NEXT_PUBLIC_BRANCH=main
```

The script also prints a single log line:

```text
Stamped build #123 at 2026-04-28T18:05:12.345Z on main @ abcdef1
```

That line makes CI logs easier to debug when comparing a deployed site with the workflow run that produced it.

## Why `NEXT_PUBLIC_*` Variables

The build info module reads `NEXT_PUBLIC_*` values because Next.js inlines them at build time.

That gives two useful properties:

1. the values are available in Server Components and Client Components
2. the UI does not need runtime environment lookups in the browser

The source module is:

- `lib/build-info.mjs`

The typed re-export used by the app is:

- `lib/build-info.ts`

`getBuildInfo()` is SSR-safe because it only reads already-inlined environment values and returns plain data.

## Mirror Badge

The mirror page top bar shows a small build badge:

```text
Build #<number> · <sha7>
```

This is intentionally unobtrusive and stays inside the existing top bar layout so the Exit link, kiosk frame, and privacy footer remain unchanged.

## Local Development Caveat

If you open the app in normal development without stamping first, the badge shows defaults:

- build number `0`
- commit SHA `0000000`
- branch `unknown`

That is expected.

To stamp a local production-style build preview:

```bash
node scripts/stamp-build-info.mjs
pnpm build
```

## Environment Variable Precedence

The important rule is that Next.js captures these values at build time.

Practical precedence:

1. values present in the environment for the build process
2. values from `.env.production.local`
3. defaults inside `lib/build-info.mjs`

For local production previews, `.env.production.local` is a convenient override point because `next build` will inline those values into the generated output.

The stamp script is wired through `package.json` as `prebuild`, so a normal `pnpm build` refreshes the file automatically.

## Rollback

Rollback is intentionally simple.

If a bad change reaches `main`:

1. run `git revert <bad-commit>` on `main`
2. push the revert commit
3. let the next `main` workflow run rebuild and redeploy production

There is no separate rollback mechanism in the workflow itself.

The deploy system follows Git history: the next successful `main` push becomes production.

## Multi-Agent Branch Workflow

Recommended branch usage for concurrent agents:

1. each agent works on its own `ca1/*` branch
2. each branch gets CI validation on push
3. no branch deploys directly to Azure
4. integration happens through a pull request into `main`
5. the pull request gets a preview deploy
6. merge to `main` triggers production deploy

This keeps branch validation cheap and deterministic while reserving SWA preview environments for actual review surfaces.
