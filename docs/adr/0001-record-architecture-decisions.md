---
status: accepted
date: 2026-10-30
deciders: owner
---

# Record architecture decisions

## Context and Problem Statement

Agents and people change this codebase in short, separate sessions. Without a written record, a later session cannot tell a deliberate decision from an accident, and either reverts it or argues it again.

## Decision Outcome

We record every decision that is expensive to reverse (a dependency, a storage choice, a module boundary, an API contract) as an ADR in `docs/adr/`, using [MADR](https://adr.github.io/madr/). Numbered `NNNN-title.md`; status `proposed` → `accepted` → `superseded by NNNN`. The architect proposes, the owner accepts. An accepted ADR is changed only by a new ADR that supersedes it.

### Consequences

- Good: reviewers check a diff against accepted ADRs instead of taste.
- Bad: a little writing for each significant decision.
