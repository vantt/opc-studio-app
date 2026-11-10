# Goals

Results with a number and a deadline for this test-bed app. Source of truth; Multica draws them
(Goals page). Test data for checking the goal sync, not a business goal.

| ID | Result | Unit | Better | Start | Target | Due | Measured by | Parent | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | Board steps shipped by the agent team | steps | higher | 0 | 8 | 2026-12-31 | script: grep -c '✅' plans/*/plan.md \| awk -F: '{s+=$2} END {print s+0}' | — | active |

## Progress

| Date | Goal | Value | Note |
| --- | --- | --- | --- |
| 2026-11-09 | G1 | 0 | start |
| 2026-11-10 | G1 | 1 | measure: grep -c '✅' plans/*/plan.md \| awk -F: '{s+=$2} END {print s+0}' |
| 2026-11-10 | G1 | 2 | nhap tren UI |
