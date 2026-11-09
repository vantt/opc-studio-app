# Pinned notes

Status: open (2026-11-09).

## Why

Users keep a few notes they open every day (a todo list, a phone number). Today they scroll for them.

## Steps

| ID | Step | Status |
|---|---|---|
| P.1 | Pin a note: `PATCH /api/notes/:id` accepts `{ "pinned": true \| false }`; `pinned` is stored with the note (default `false`, old data files without it still load) and returned by every notes endpoint | ✅ 2026-11-09 · [PR #6](https://github.com/vantt/opc-studio-app/pull/6) · STU-17 · review: "Không có finding P0–P3 … `make check` xanh" |
| P.2 | Pinned first: `GET /api/notes` (with or without `?q=`) returns pinned notes first, each group keeps its current order; the web page shows a pin toggle and a 📌 on pinned notes | ⬜ after P.1 |

## Decisions

- No limit on how many notes can be pinned.
- No separate "pinned" endpoint; the list order is enough.

## Check

- `make check` green; tests for pin, unpin, bad value (`"yes"` → 400), old data file without `pinned`, and list order.
