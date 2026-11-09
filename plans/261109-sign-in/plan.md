# Sign-in

Status: backlog (2026-11-09).

## Why

Notes are shared by everyone who reaches the server. Each person should see only their own notes.

## Steps

| ID | Step | Who | Status |
|---|---|---|---|
| S.1 | Email one-time-code sign-in: `POST /api/auth/code` sends a 6-digit code, `POST /api/auth/verify` returns a session cookie; notes belong to the signed-in account; unauthenticated notes requests get 401 | Agent | ⬜ |
| S.2 | Move existing notes to the first account that signs in | Agent | ⬜ after S.1 |
