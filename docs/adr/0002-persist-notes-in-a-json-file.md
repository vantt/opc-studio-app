---
status: accepted
date: 2026-10-30
deciders: owner
---

# Persist notes in a single JSON file

## Context and Problem Statement

Notes live only in process memory (`src/notes.ts`), so a restart loses them. The owner wants notes to survive restarts on the machine running the app, while the app still needs nothing but Node to install and run, and existing create, edit, delete and search behaviour stays exactly as it is.

## Considered Options

- A single JSON snapshot file written with `node:fs`
- `node:sqlite` (`DatabaseSync`)
- An append-only JSON-lines log replayed at startup

## Decision Outcome

Chosen option: **a single JSON snapshot file**. It needs no dependency and no API that is still experimental, it keeps search on the in-memory list so behaviour cannot drift, and at this app's scale (thousands of notes of at most 5 KB) rewriting the whole file costs milliseconds.

- The file holds `{ "version": 1, "nextId": n, "notes": [...] }`. `nextId` is stored so ids are never reused across restarts.
- Path from `DATA_FILE`, default `./data/notes.json`; `data/` is git-ignored.
- Every mutation is written synchronously (`*.tmp`, fsync, rename) **before** memory changes or the response is sent. A failed write returns 500 and leaves memory unchanged.
- A missing file starts empty. An unreadable or invalid file stops startup with an error naming the path; the app never overwrites a file it could not read.
- `src/notes.ts` stays free of I/O; `src/storage.ts` does the file work; only `src/main.ts` wires them. `test/architecture.test.ts` enforces this.

### Consequences

- Good: zero dependencies; the data is human-readable and backed up with `cp`; the domain and HTTP layers barely change.
- Bad: each write costs O(all notes); one process per file (no locking); a crash between rename and directory sync on some filesystems may lose the last write.
- Revisit when: writes become measurably slow, or more than one process must share the data. Then supersede this ADR (likely with `node:sqlite` once stable).

## Pros and Cons of the Options

### `node:sqlite`

- Good: per-row writes, transactions, scales further.
- Bad: not yet stable in Node 24; search would move to SQL, where `LIKE` case-folding differs from today's `toLowerCase().includes`; binary file; needs schema migrations.

### Append-only log

- Good: O(1) writes.
- Bad: must handle a torn last line and add compaction; most moving parts for no current need.
