# Ops & Planning — Programme Operations & Planning Platform

## Overview
Mobile Expo app (React Native) for organisations to manage a Stream → Team → Project → Milestone hierarchy plus a separate Events calendar. **All data is API-backed** — every screen reads/writes through `@workspace/api-client-react` (generated Orval React Query hooks) against the Express + PostgreSQL API in `artifacts/api-server`. No more local Zustand/AsyncStorage store.

API contract: `lib/api-spec/openapi.yaml`. Run `pnpm --filter @workspace/api-spec run codegen` after editing. Generated zod schemas live in `lib/api-zod`, React Query hooks in `lib/api-client-react`. DB schema sources of truth: `lib/db/src/schema/*` (push with `pnpm --filter @workspace/db run push`).

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native 0.81
- **Data layer**: `@workspace/api-client-react` generated React Query hooks (Orval). `QueryClientProvider` is set up in `app/_layout.tsx` (defaults `retry: 1`, `refetchOnWindowFocus: false`). After mutations, screens call `queryClient.invalidateQueries({ queryKey: getXxxQueryKey(...) })`.
- **Auth**: Real password auth via `/api/auth/login` (server bcrypt + 30-day session token). Token stored in `expo-secure-store` (native) / `localStorage` (web). `lib/auth/AuthContext.tsx` is the source of truth for the signed-in user. AuthGate in `app/_layout.tsx` waits on it. Generated client base URL + bearer header are configured at module load via `setBaseUrl` / `setAuthTokenGetter`.
- **Fonts**: @expo-google-fonts/inter (400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)

### Permissions (`lib/permissions/index.ts`)
All screens use the API-backed helpers (no more legacy store helpers):
- React hooks: `useMe()`, `useCanManageEverything()`, `useCanManageStream(streamId)`, `useCanManageTeam(team)`, `useCanCreateForTeam(team)`, `useCanManageTeamLeaders(team)` (admin / in-scope PO / in-scope SO only), `useCanManageTeamAdmins(team)` (same tiers plus any current leader of the team — team_admin is NEVER allowed).
- Pure functions: `canManageEverything/Stream/Team/CreateForTeam/TeamLeaders/TeamAdmins` accept a `Principal` (the User from `useGetMe`).

### Roles (5 login tiers + non-login members)
- **admin** — Full access across every programme
- **programme_overseer** — Full access to all streams/teams within their assigned programme. Cannot invite admins or other programme overseers; cannot create org-wide events (admin-only)
- **stream_overseer** — Full access to all teams within their assigned stream
- **leader** — Manages one or more teams (multiple leaders per team allowed). Can add/remove team leaders AND team admins for teams they lead.
- **team_admin** — Same day-to-day access as `leader` for projects/milestones/members/notes/team-scoped events, on teams where they appear in `team_managers` with role `team_admin`. **Cannot** add/remove other managers.
- **(member)** — NOT a login role. Members are roster-only entries on a team.

**Team manager grants are decoupled from primary role.** Any active user — including admins and stream/programme overseers — can be added to a team's `leaderIds` or `teamAdminIds` via the team detail page. The grant only affects appearance in the team's Leaders / Team Admins lists for visibility and accountability; the user's actual access tier still comes from their primary `role`. The Add Leader / Add Team Admin pickers list **every** active user not already in that team's manager lists, sorted by name, with their primary role shown as a sub-label.

Per-team management is tracked in the `team_managers` join table (`team_id, user_id, role`). The `Team` resource exposes derived `leaderIds[]` and `teamAdminIds[]`. Users expose derived `leaderTeamIds[]` and `teamAdminTeamIds[]` (the previous single `users.team_id` column was dropped; a user can manage multiple teams).

### Hierarchy
```
Streams → Teams → Projects → Milestones
Members are top-level (table) but always scoped to a team
Each Team has its own Notes timeline (TeamNote rows)
Events are separate, optionally linked to a stream OR team via invitedTeamIds
```

### Key generated hooks used across screens
- Streams: `useListStreams`, `useGetStream`, `useListStreamTeams`, `useCreateStream`, `useUpdateStream`, `useDeleteStream`
- Teams: `useListTeams`, `useGetTeam`, `useCreateTeam`, `useUpdateTeam`, `useDeleteTeam`, `useAddTeamManager`, `useRemoveTeamManager`, `useListTeamMembers`, `useCreateTeamMember`, `useDeleteMember`, `useListTeamNotes` + note CRUD
- Projects/Milestones: `useListProjects`, `useGetProject`, `useCreateProject`, `useUpdateProject`, `useDeleteProject`, `useListProjectMilestones`, `useCreateMilestone`, `useSetMilestoneStatus`, `useDeleteMilestone`
- Events: `useListEvents`, `useGetEvent`, `useCreateEvent`, `useDeleteEvent`
- Users: `useListUsers`, `useGetMe`, `useUpdateUserRole`, `useDeleteUser`
- Programme: `useGetProgramme` (used to discover `programmeId` when creating streams)

When passing `query: { enabled }`, the orval-generated `UseQueryOptions` requires a `queryKey`, so screens pass `queryKey: getXxxQueryKey(id)` alongside `enabled`.

### Auth flow (server-backed)
1. **First admin** is created via `POST /api/auth/setup` (only allowed when the
   `users` table is empty AND `SETUP_SECRET` is set).
2. Admin (or in-scope stream overseer) invites a user via `/new-user` →
   server creates an inactive user row plus an invite row in a single
   transaction and returns a 6-char code (Crockford-ish alphabet, no I/O/0/1).
3. Invitee opens `/accept-invite`, enters the code + a password → server
   activates the pre-provisioned user, consumes the invite, and returns a
   session token; the mobile app immediately signs them in.
4. Subsequent logins use email + password at `/login`.

### App Structure
```
artifacts/mobile/app/
├── _layout.tsx              # AuthGate; PUBLIC_ROUTES: /login, /accept-invite
├── login.tsx                # Email + password login
├── accept-invite.tsx        # 6-char code + password
├── new-user.tsx             # Admin invite → /api/auth/invite, shows returned code
├── (tabs)/
│   ├── index.tsx            # Dashboard: tiles, overdue, due today, upcoming events
│   ├── programme.tsx        # Streams → teams view
│   ├── calendar.tsx         # Monthly grid + day list
│   └── settings.tsx         # Profile, role chip, admin shortcut, sign out
├── admin/index.tsx          # Tabs: Structure (drill-down Programmes → Streams → Teams) / Programmes / Users / Members / Events
├── stream/[id].tsx          # Rename/delete stream, list teams
├── team/[id].tsx            # Members CRUD, projects, leader, notes timeline
├── project/[id].tsx         # Milestones with All/Today/Upcoming/Overdue/Completed filters
├── event/[id].tsx           # Event detail
├── new-stream.tsx           # Admin only
├── new-team.tsx             # Admin/overseer; stream scoped
├── new-project.tsx          # Admin/overseer/leader (where allowed)
├── new-milestone.tsx        # Same scoping
└── new-event.tsx            # Date offset chips + time chips; team-scoped
```

### Shared building blocks
- `components/LoadingRow.tsx`, `components/ErrorBanner.tsx` — query-state UI
- `components/MilestoneRow.tsx` — checkbox toggles `completed` via `useSetMilestoneStatus`
- `components/CreateActionSheet.tsx` — role-aware "+" hub
- `models/types.ts` — thin shim re-exporting types from `@workspace/api-client-react` plus `isOverdue` / `isDueToday` helpers built on `Milestone.date` + `!completed`

## Production hosting

Production is deployed to **Render**, not Replit. The migration is described
in `RENDER_DEPLOY.md` at the repo root. Three Render resources back the app:

- `ops-planning-db` — Postgres (managed)
- `ops-planning-api` — Web Service running `artifacts/api-server`
- `ops-planning-web` — Static Site serving `artifacts/mobile/dist` (the
  Expo web SPA built with `pnpm --filter @workspace/mobile run build:web`)

The web client reaches the API via `EXPO_PUBLIC_API_BASE_URL`, which must
be set on the static site before building. `APP_DOMAIN` on the API must
point at the SPA's public URL so invite/reset emails render correct links.
`lib/db/src/index.ts` auto-enables TLS for Render/Neon/Supabase/RDS
connection strings; override with `PGSSL=disable|require` if needed.

### Weekly updates (stream overseer reports)
Confidential weekly status reporting, backed by the `weekly_updates` table
(`id, authorId→users, streamId→streams, weekStart (date, Monday UTC), body,
createdAt, updatedAt`; unique on `(authorId, weekStart)`). Week boundaries are
computed **server-side** (`weekStartOf` in `routes/weeklyUpdates.ts`, Monday UTC),
so updates can't be backdated; the mobile screen mirrors the same helper to
compute the current week.

- **POST /weekly-updates** (`submitWeeklyUpdate`) — stream overseers only, and
  only if they have a `streamId`. Upserts the current week's row
  (`onConflictDoUpdate` on the `(authorId, weekStart)` unique constraint), so a
  second submit edits rather than duplicates.
- **GET /weekly-updates** (`listWeeklyUpdates`) — role-scoped: admin = all,
  `programme_overseer` = updates whose stream is in their programme,
  `stream_overseer` = only their own. Everyone else → 403.
- **GET /weekly-updates/status** (`getWeeklyUpdateStatus`) — current-week
  submission status for active stream overseers in scope (inner join on streams,
  so overseers with no `streamId` are excluded). Used to render the "not yet
  submitted this week" list. SO sees only themselves; PO sees their programme;
  admin sees all.

Mobile screen is `app/weekly-updates.tsx` (registered in `_layout.tsx` Stack),
reached from a Dashboard tab entry visible to admin / programme_overseer /
stream_overseer. It's role-adaptive: overseers get a composer for the current
week plus their own history; PO/admin get the "not yet submitted" card plus all
in-scope updates grouped by week.

## User preferences
- Real email login (no profile picker)
- Stream overseers must have full access across all teams in their stream
- Members are roster entries, not login accounts

## Gotchas
- Don't pass `query: { enabled: x }` to a generated hook without also passing `queryKey: getXxxQueryKey(...)` — the strict `UseQueryOptions` requires it.
- After any mutation, invalidate the relevant list/detail query keys so the UI refetches.
- The `useListEvents` endpoint already applies server-side visibility filtering.
- **`APP_DOMAIN` env var is required in production** — set it to the canonical HTTPS origin (e.g. `https://your-app.replit.app`). `getAppDomain()` in `artifacts/api-server/src/routes/auth.ts` reads this to build invite and password-reset links. Without it, emailed links point to `https://localhost` (safe fallback — no host-header poisoning, but links won't work until the var is set).
- Admin Users tab role chip opens an explicit "Change role" dialog (lists all 5 roles with one-line descriptions) — no more cycle-on-tap. Switching to a role that needs a scope (programme / stream / team) prompts for it inline if the user doesn't already have one. Only admins can change roles (server-enforced via `requireAdmin`).
- Admin Structure tab is a three-level drill-down: Programmes → Streams → Teams. State is a local `{programmeId, streamId}` view stack (no new routes). Programme rename/delete still live on the Programmes admin tab; stream and team rename/delete remain on the Structure level where they're listed.
- `dialog.choice` accepts `searchable: true` (+ optional `searchPlaceholder`) to render a filter input above the option list — currently enabled on the team Add Leader / Add Team Admin pickers and on the admin Users tab's "Pick a stream" / "Pick a team" scope pickers. Filter is a case-insensitive substring match against `label`, so labels formatted as `"Name  ·  Role"` are searchable by either side.
- Invite codes are 16 characters (32-char alphabet, ≈ 2^80 entropy). The mobile accept-invite screen enforces `maxLength={16}` and only triggers the preview API call once 16 chars are entered. Server-side Zod schemas for `AcceptInviteBody` and `GetInviteByTokenParams` enforce exactly 16 chars, so legacy 6-char tokens already in the DB are rejected at the validation layer and cannot be redeemed.
