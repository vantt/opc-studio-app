# AGENTS.md

Rules for every agent (and person) working in this repo. Read this before touching code.

## Commands

| What | Command |
|---|---|
| Install | `npm ci` |
| Run | `npm start` (http://127.0.0.1:3000, `PORT`/`HOST` override) |
| **Check everything** | `make check` — lint, typecheck, tests, dependency audit, secret scan. CI runs exactly this. |
| One part | `make lint`, `make typecheck`, `make test`, `make audit`, `make secrets` |
| Format | `npm run format` |

"Done" means `make check` passes and its output is pasted in the PR. A partial check proves nothing.

## Stack

Node 24 runs the TypeScript directly (type stripping): no build step, no `enum`, no parameter properties, no namespaces, imports end in `.ts`. Tests use `node:test`. No runtime dependencies; adding one needs an ADR.

## Layout

See [ARCHITECTURE.md](ARCHITECTURE.md). Decisions live in [docs/adr/](docs/adr/), lessons from past work in [docs/solutions/](docs/solutions/) — read the solutions index before planning.

## Git and pull requests

- One branch per issue: `multica/STU-<n>-<slug>`. One PR per issue, title `STU-<n>: <summary>`, using the PR template.
- Only the developer pushes to the issue branch. Reviewers and QA check out the exact SHA they were given and never push.
- Never push to `main`, force-push someone else's branch, rewrite shared history, or edit `.github/workflows/` (the agent token cannot, on purpose).
- Never delete, skip or weaken a test, or relax a check, to make it pass. If a test is wrong, say so in the PR and let the owner decide.
- `main` is protected: CI green and the owner's approval are required to merge.

## Code

- Validate untrusted input at the edge (`parseNoteInput`), return JSON errors with the right status.
- Every behaviour change comes with a test that fails without it.
- Keep functions small and named for what they do; comment why, not what.
- No secrets in code, tests or fixtures. `make secrets` fails the build if one slips in.
