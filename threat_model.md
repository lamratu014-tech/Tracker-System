# Threat Model

## Project Overview

Ops & Planning is an Expo mobile application backed by an Express 5 API and PostgreSQL via Drizzle ORM. The production server-side surface is concentrated in `artifacts/api-server/src`, with authentication, invitation, password-reset, and user-management endpoints under `/api`. The mobile client in `artifacts/mobile` stores a bearer session token locally and calls the API directly.

Production assumptions for this scan:
- `NODE_ENV` is `production` in deployed environments.
- TLS between clients and the deployed app is provided by the platform.
- `artifacts/mockup-sandbox/` is dev-only and out of scope unless production reachability is demonstrated.
- Local Expo/mobile build scripts are dev-only unless they influence deployed server behavior.

## Assets

- **User accounts and roles** — user identities, roles (`admin`, `stream_overseer`, `leader`; non-login `member` entries are roster-only and live in a separate table), active/inactive state, and invitation metadata. Exposure or modification would enable impersonation, privilege abuse, or privacy violations.
- **Session tokens** — 64-character hex bearer tokens stored in the database and on the client. Compromise gives direct API access for the token lifetime.
- **Password reset and invite tokens** — unauthenticated one-time bearer secrets that bootstrap account access or password changes. Leakage results in account takeover.
- **User profile data** — names, email addresses, departments, role assignments, and inviter metadata. This is internal organizational data and should only be disclosed on a need-to-know basis.
- **Application secrets** — `DATABASE_URL`, `RESEND_API_KEY`, and any logged reset/invite URLs. Disclosure can compromise accounts or service integrations.

## Trust Boundaries

- **Mobile/Web client to API** — all request bodies, headers, and query parameters are untrusted. Authentication and authorization must be enforced server-side.
- **API to PostgreSQL** — the API has direct authority to create users, sessions, invites, and reset tokens. Logic flaws here can become account takeover or mass data exposure.
- **API to email delivery** — invite and reset links cross into a third-party email service and user inboxes. Link construction and token handling must assume the URL itself is sensitive.
- **Public to authenticated boundary** — `/api/auth/status`, `/api/auth/login`, `/api/auth/setup`, `/api/auth/forgot-password`, `/api/auth/reset-password`, `/api/auth/accept-invite`, and `/api/auth/invite/:token` are reachable without a session; all others should be protected appropriately. `/api/auth/setup` is only valid when the `users` table is empty AND `SETUP_SECRET` is set — there is no public self-signup route.
- **Authenticated to manager boundary** — `requireManager` admits `admin`, `stream_overseer`, and `leader` roles for create/update/delete on streams, teams, projects, milestones, members, team notes, and events. Per-stream / per-team scoping must be enforced inside each route handler, not by the middleware alone.
- **Authenticated to admin boundary** — `requireAdmin` covers user lifecycle (`POST /api/users`, `PATCH /api/users/:id/role`, `/deactivate`, `/reactivate`, `DELETE /api/users/:id`), invite issuance (`POST /api/auth/invite`), stream creation, and programme updates. These must be restricted to admins on the server, not just hidden in the UI.
- **Production to dev-only boundary** — `artifacts/mockup-sandbox/` and local build helpers are not production attack surface unless explicitly wired into deployed workflows.

## Scan Anchors

- **Production entry points:** `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/auth.ts`, `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/middlewares/requireAuth.ts`.
- **Highest-risk areas:** token issuance/validation in `artifacts/api-server/src/lib/auth.ts`; password reset and invite flows in `artifacts/api-server/src/routes/auth.ts` (especially any link generation that derives origins from request headers, plus invite preview/redeem token handling); first-admin bootstrap (`POST /api/auth/setup`); row-level visibility and mutation checks in `artifacts/api-server/src/routes/streams.ts`, `artifacts/api-server/src/routes/teams.ts`, and `artifacts/api-server/src/routes/teamNotes.ts`; client token/link handling in `artifacts/mobile/lib/auth/AuthContext.tsx` (sets the generated client base URL + bearer header), `artifacts/mobile/lib/auth/storage.ts`, and `artifacts/mobile/app/accept-invite.tsx`.
- **Public surfaces:** auth status, login, first-run setup (gated on empty `users` table + `SETUP_SECRET`), invite acceptance, password reset request/reset, invite token lookup.
- **Authenticated surfaces:** `/api/auth/me`, `/api/auth/logout`, `/api/users`, all read endpoints under streams/teams/projects/milestones/events/team-notes/activity.
- **Manager surfaces (`admin` | `stream_overseer` | `leader`):** create/update/delete for streams (update/delete only), teams, projects, milestones, members, team notes, events. Per-row scoping must be enforced in the handler.
- **Admin surfaces:** invite creation, stream creation, programme update, and the full user lifecycle (`POST /api/users`, role/deactivate/reactivate/delete).
- **Usually ignore as dev-only:** `artifacts/mockup-sandbox/`, `artifacts/mobile/scripts/build.js`, local Expo/Metro helpers.

## Threat Categories

### Spoofing

This project relies on opaque bearer session tokens and bearer-style invite/reset tokens. All protected endpoints must require a valid, unexpired server-side token, and unauthenticated bootstrap flows must never leak reset or invite secrets to unauthorized parties.

### Tampering

Role changes, account activation state, account deletion, and password changes are sensitive state transitions. The API must enforce these transitions server-side, validate the acting principal, and ensure public token-based flows cannot be replayed or abused to alter the wrong account.

### Information Disclosure

The API handles internal staff directory data, organisation structure, and sensitive one-time URLs. Responses, logs, and email fallbacks must not expose password reset tokens, invite tokens, stream/team metadata, or broad user lists to parties that do not need them. Error handling should avoid leaking whether protected resources exist beyond what is operationally required.

### Denial of Service

Public auth endpoints can be hit without authentication. Password reset, login, invite preview, and invite redemption routes should avoid becoming brute-force or spam amplifiers, and expensive operations should not be triggerable without bounds. Short bearer-style invite codes are only acceptable if paired with strong online abuse controls.

### Elevation of Privilege

There are three privilege boundaries: any authenticated user → manager (`admin` | `stream_overseer` | `leader`) → admin. `requireManager` only checks the role tier; per-stream and per-team scoping (e.g. a `leader` only mutating their own team, an `stream_overseer` only acting inside their assigned stream) must be enforced inside each route handler. Routes that expose or mutate user records must enforce least privilege, and public bootstrap flows (`/auth/setup`, invite acceptance, password reset) must not let an attacker turn knowledge of an email address into control of that account or escalate from `leader`/`stream_overseer` to `admin`.