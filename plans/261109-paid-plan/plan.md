# Paid plan

Status: backlog (2026-11-09).

## Why

Test whether anyone pays for synced notes.

## Steps

| ID | Step | Who | Status |
|---|---|---|---|
| B.1 | Pick the monthly price | Owner | ⬜ |
| B.2 | Checkout endpoint: `POST /api/checkout` creates a card checkout session with the payment provider for the monthly price and returns its URL; a webhook marks the account paid | Agent | ⬜ after B.1 |

## Open

- Payment provider (Stripe or Polar).
