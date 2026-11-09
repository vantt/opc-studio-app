# Program board: opc-studio-app

This board is high-level: one row = one epic = one plan. Step status and evidence live in the plan, not here.

**Context:** test bed for the OPC Studio coding team and its PM (Hà). Small, real epics so the board → issue → plan loop can be checked end to end.

**Last updated:** 2026-11-09 (board sync)

## Overview

3 epics:
- In progress: E1.
- Backlog with a plan: E2, E3.

## In progress

Steps the agent is running, taken from plans. Steps waiting on the human are not here.

| ID | Step | Plan | Notes |
|---|---|---|---|
| (none) | | | |

## Next

### Next step of plans in progress

At most 1 step per plan.

| ID | Step | Plan | Who | Condition |
|---|---|---|---|---|
| (none) | | | | |

### Next plans

At most 3 epics, in the order to open them.

| # | Epic | Plan | Priority | First step | Who | Condition |
|---|---|---|---|---|---|---|
| 1 | E2 Paid plan | [paid-plan](261109-paid-plan/plan.md) | P2 | B.1 owner picks the price; B.2 checkout endpoint | B.1 human; B.2 agent | B.2 after B.1 |

## Needs the human

The only section that holds steps waiting on the human.

| ID | Step | Plan | What the human must do |
|---|---|---|---|
| E2 | B.1 Price | [paid-plan](261109-paid-plan/plan.md) | Pick the monthly price and write it into the plan |
| E1 | P.1 Pin a note | [pinned-notes](261109-pinned-notes/plan.md) | Duyệt STU-17 (stored data shape change): kéo sang todo |
| E3 | S.1 Email one-time-code sign-in | [sign-in](261109-sign-in/plan.md) | Duyệt STU-19 (auth, sessions, L): kéo sang todo |

## Backlog

All epics, from idea to done. One plan per epic.

| ID | Epic | Plan | Status | Priority | Depends on | Notes |
|---|---|---|---|---|---|---|
| E1 | Pinned notes: pin a note, pinned notes listed first | [pinned-notes](261109-pinned-notes/plan.md) | 🔄 Doing | P1 | — | |
| E2 | Paid plan: a monthly subscription with card checkout | [paid-plan](261109-paid-plan/plan.md) | 📥 Backlog | P2 | — | Touches payment |
| E3 | Sign-in: email one-time code, notes per account | [sign-in](261109-sign-in/plan.md) | 📥 Backlog | P2 | — | Touches auth |

Status: 📥 Backlog, ⬜ Todo, 🔄 Doing, ⏸ Waiting, ✅ Done, ❌ Dropped.
Priority: P1 needed first, P2 should do, P3 later.

## How to update the board

Rule: **plan first, board second.** Step status and evidence live only in the plan.

1. New idea: add a Backlog row with the next epic ID, status 📥, plan `—`.
2. Plan created: link it in the Plan column, set ⬜ Todo.
3. Start a step: mark it in the plan first. Agent step goes to "In progress", human step to "Needs the human", never both. Epic becomes 🔄 Doing.
4. Finish a step: mark ✅ with evidence in the plan; remove the board row; promote the plan's next step to "Next".
5. Human step: only in "Needs the human", with what they must do; remove it when done.
6. Epic finished: the owner sets ✅ Done and picks the next epic for "Next plans" (max 3).
7. Never copy progress or evidence onto the board.
8. Update "Last updated".
