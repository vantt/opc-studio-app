# Architecture

A small notes service: a JSON API and one web page, served by a single Node process. It exists so the OPC Studio coding team has a real codebase to practise on; keep it small and honest.

## Context (C4 level 1)

```
Owner / QA agent ──browser──▶ opc-studio-app (Node 24, :3000) ──▶ memory (no database yet)
```

## Code map

| Path | Responsibility | Depends on |
|---|---|---|
| `src/notes.ts` | Domain: `Note`, input validation (`parseNoteInput`), `NoteStore` (in-memory, ids never reused) | nothing |
| `src/server.ts` | HTTP: routing, JSON body parsing (16 KiB limit), error → status mapping | `notes.ts`, `node:http` |
| `src/main.ts` | Process entry: reads `PORT`/`HOST`, starts the server | `server.ts` |
| `public/index.html` | The web page; talks to the API with `fetch` only | the API |
| `test/` | `node:test` unit tests (domain) and HTTP tests (real server on a random port) | |

## Invariants

- `notes.ts` imports nothing from `server.ts` or `node:http`: the domain stays testable without HTTP.
- All input from the network goes through `parseNoteInput` before reaching the store.
- Errors never leak stack traces to clients; unknown errors become `500 internal error`.

## Decisions

See [docs/adr/](docs/adr/).
