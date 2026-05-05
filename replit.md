# Ops & Planning — Programme Operations & Planning Platform

## Overview
Mobile Expo app (React Native) for organisations to manage a Stream → Team → Project → Milestone hierarchy plus a separate Events calendar. **Migrating from local-first to API-backed**: domain data (streams/teams/projects/milestones/events/members/team-notes) still lives in a Zustand global store persisted to AsyncStorage, but **auth/invites are server-backed** — login, invite creation, and invite acceptance go through the Express + PostgreSQL API in `artifacts/api-server`. Per-screen migration of the rest of the data layer is tracked in follow-up tasks.

API contract: `lib/api-spec/openapi.yaml` covers the Stream→Team→Project→Milestone hierarchy plus events/team-notes/members and the 3-role auth model. Run `pnpm --filter @workspace/api-spec run codegen` after editing the spec; generated zod schemas live in `lib/api-zod` and React Query hooks in `lib/api-client-react`. DB schema sources of truth: `lib/db/src/schema/*` (push with `pnpm --filter @workspace/db run push`).

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native 0.81
- **State**: Zustand global store with `persist` middleware (AsyncStorage); persist key `ops-planning-store-v2`
- **Auth**: Real password auth via `/api/auth/login` (server bcrypt + 30-day session token). Token stored in `expo-secure-store` (native) / `localStorage` (web). `lib/auth/AuthContext.tsx` is the source of truth for the signed-in user; AuthGate in `_layout.tsx` waits on it. Generated client base URL + bearer header are configured at module load via `setBaseUrl`/`setAuthTokenGetter`.
- **Fonts**: @expo-google-fonts/inter (400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)

### Roles (3 login tiers + non-login members)
- **admin** — Full access across the whole programme
- **stream_overseer** — Full access to all teams within their assigned stream
- **leader** — Manage their own team only
- **(member)** — NOT a login role. Members are roster-only entries on a team (top-level `members[]`)

### Permission helpers
- New API-backed helpers live in `lib/permissions/index.ts` and read identity from `useGetMe()` (the React Query hook). They're the way forward for migrated screens.
  - `useMe()`, `useCanManageEverything()`, `useCanManageStream(streamId)`, `useCanManageTeam(team)`, `useCanCreateForTeam(team)` (team is `{ id, streamId? }`).
  - Pure helpers `canManageEverything/Stream/Team/CreateForTeam` accept a `Principal = Pick<User, "id" | "role" | "streamId" | "teamId">`.
- Legacy store-based helpers in `store/useStore.ts` (`canManageStream`, `canManageTeam`, `canCreateForTeam`, `useCurrentUser`, `useCanManageStream`, `useCanManageTeam`) remain in place during the per-screen migration and will be removed once every screen reads from the API.

### Shared loading/error UI
- `components/LoadingRow.tsx` and `components/ErrorBanner.tsx` — small reusable building blocks for the React Query loading/error states screens will need as they migrate.

### Data layer migration status
- React Query is wired (`QueryClientProvider` in `app/_layout.tsx`, defaults `retry: 1`, `refetchOnWindowFocus: false`).
- Domain data (streams/teams/projects/milestones/events/members/team notes) is **still served from the Zustand store**; per-screen migration to generated React Query hooks is tracked as a separate task. Once that completes, the server collections and `seed/resetSeed` will be stripped from the store.

### Hierarchy
```
Streams → Teams → Projects → Milestones
Members are top-level, scoped to a team
Each Team has its own Notes timeline (TeamNote[] on Team)
Events are separate, optionally linked to a stream OR team
```

### Auth flow (server-backed)
1. **First admin** is created via `POST /api/auth/setup` (only allowed when the
   `users` table is empty AND `SETUP_SECRET` is set). Example:
   `curl -X POST "$REPLIT_DEV_DOMAIN/api/auth/setup" -H "content-type: application/json" -d "{\"email\":\"...\",\"name\":\"...\",\"password\":\"...\",\"setupSecret\":\"$SETUP_SECRET\"}"`
2. Admin (or in-scope stream overseer) invites a user via `/new-user` →
   server creates an **inactive** user row (no passwordHash, active=false)
   plus an invite row in a single transaction, and returns a 6-char code
   (Crockford-ish alphabet, no I/O/0/1). The "Invite created" screen
   displays the code with a Copy action.
3. Invitee opens `/accept-invite`, enters the code + a password (display
   name comes from the invite row) → server activates the pre-provisioned
   user (sets passwordHash, flips active=true), consumes the invite, and
   returns a session token; the mobile app immediately signs them in.
4. Subsequent logins use email + password at `/login`.
5. Reusing or mistyping a code surfaces a clear server-side error.

### App Structure
```
artifacts/mobile/app/
├── _layout.tsx              # AuthGate; PUBLIC_ROUTES: /login, /accept-invite
├── login.tsx                # Email + password login (calls /api/auth/login)
├── accept-invite.tsx        # 6-char code + password; name pulled from invite preview (calls /api/auth/accept-invite)
├── new-user.tsx             # Admin invite → calls /api/auth/invite, shows returned code
├── (tabs)/
│   ├── index.tsx            # Dashboard: tiles, overdue, due today, upcoming events
│   ├── programme.tsx        # Streams → teams view
│   ├── calendar.tsx         # Monthly grid (prev/next/today, dot indicators, day list)
│   └── settings.tsx         # Profile, role chip, admin shortcut, sign out, reset seed
├── admin/index.tsx          # Tabs: Structure / Users / Members / Events; role cycle Admin→Overseer→Leader
├── stream/[id].tsx          # Rename/delete stream, list teams (overseer/admin can manage)
├── team/[id].tsx            # Members CRUD (top-level members[]), projects, leader
├── project/[id].tsx         # Filter tabs: All/Today/Upcoming/Overdue/Completed
├── event/[id].tsx           # Event detail
├── new-stream.tsx           # Admin only
├── new-team.tsx             # Admin/overseer; stream scoped
├── new-project.tsx          # Admin/overseer/leader (where allowed)
├── new-milestone.tsx        # Same scoping
└── new-event.tsx            # Date YYYY-MM-DD + time HH:MM chips; overseer scope
```

### Store actions
- Auth: `loginByEmail`, `loginById`, `logout`, `inviteUser`, `acceptInvite`, `clearLastInviteCode`
- CRUD: streams, teams, projects, milestones, events, users
- Members: `addMember`, `updateMember`, `deleteMember`
- Team notes: `addTeamNote(input, authorId)`, `updateTeamNote(id, body)`, `deleteTeamNote(id)` — leaders/overseers/admins can post; authors (or admins) can edit/delete
- `resetSeed()` — restores demo data

## User preferences
- Local-first, no backend dependency for the mobile app
- Real email login (no profile picker)
- Stream overseers must have full access across all teams in their stream
- Members are roster entries, not login accounts
