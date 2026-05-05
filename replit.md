# Ops & Planning — Programme Operations & Planning Platform

## Overview
A mobile Expo app (React Native) for organisations to manage a Programme → Stream → Team → Tasks/Calendar/Files hierarchy. Fully server-backed with strict role-based access control (RBAC), cross-team events, calendar, and backend-enforced permissions.

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native
- **API Server**: Express 5 + PostgreSQL via Drizzle ORM
- **Auth**: bcryptjs password hashing, 64-char hex session tokens in DB, Resend for invite emails
- **Fonts**: @expo-google-fonts/inter (Inter 400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)
- **State**: React Context (AuthContext, DataContext) — all API-backed, no local storage

### Roles (2 tiers)
- **programme_lead** — Full access: manage programme, streams, teams, users, all projects/events across the programme
- **team_lead** — Manage own team's workspace (tasks, milestones, events, members/personnel)

### Helper flags in AuthContext
- `isProgrammeLead` — true only for programme_lead
- `isTeamLead` — true for both programme_lead and team_lead (can edit any team data)

### Hierarchy
```
Programme
└── Stream(s)  (e.g. Marketing, Operations, Technology)
    └── Team(s)  (execution groups; teamId assigned to users)
        ├── Tasks  (via Projects)
        ├── Calendar Events
        ├── Members (non-user Personnel records)
        └── Projects / Notes
```

### App Structure
```
artifacts/mobile/
├── app/
│   ├── _layout.tsx          # Root layout; AuthProvider > DataProvider > AuthGate
│   ├── login.tsx            # Sign-in / first-run programme lead setup screen
│   ├── accept-invite.tsx    # Accept invite link → set name+password → auto-login
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom tab navigator (Dashboard/Programme/Calendar/Settings)
│   │   ├── index.tsx        # Dashboard: role-split (PL sees programme stats; TL sees own team)
│   │   ├── programme.tsx    # Programme hierarchy: Streams → Team cards (locked if not own)
│   │   ├── calendar.tsx     # Monthly calendar + event list
│   │   └── settings.tsx     # User profile (shows stream, team, role), PL shortcut, sign-out
│   ├── admin/
│   │   ├── _layout.tsx      # Programme Lead area layout + auth guard
│   │   └── index.tsx        # PL Panel: Users / Structure (streams+teams) / Activity / Settings
│   ├── stream/[id].tsx      # Stream detail: edit stream, list teams with progress
│   ├── team/[id].tsx        # Team workspace: Tasks | Projects | Members | Notes tabs
│   ├── event/[id].tsx       # Event detail: visibility-aware (full vs shared)
│   ├── project/[id].tsx     # Project detail + role-gated edit actions + task/milestone tabs
│   ├── new-stream.tsx       # New stream modal (PL only)
│   ├── new-team.tsx         # New team modal (PL only)
│   ├── new-event.tsx        # New event modal: internal + shared descriptions, team invites
│   └── new-project.tsx      # New project modal: team selector + metadata
├── context/
│   ├── AuthContext.tsx      # API-backed auth: login/logout/setup/invite/role mgmt
│   │                        # Exports: isProgrammeLead, isTeamLead
│   └── DataContext.tsx      # API-backed: Programme, Streams, Teams, Personnel, Projects,
│                            #             Tasks, Milestones, Events, Activity
├── services/
│   └── api.ts               # Typed fetch wrapper; token in SecureStore/localStorage
├── components/
│   ├── EventCard.tsx        # Visibility-aware: shows "Shared" badge for invited teams
│   ├── ProjectCard.tsx      # Shows teamName + dueDate
│   ├── TaskItem.tsx         # Shows assignedUserName or assignedMemberName
│   └── StatusBadge.tsx
├── hooks/
│   └── useColors.ts         # Light/dark palette from constants/colors.ts
└── constants/
    └── colors.ts            # Design tokens

artifacts/api-server/src/
├── app.ts                   # Express app, CORS, pino-http, /api router
├── index.ts                 # Listens on $PORT
├── middlewares/
│   └── requireAuth.ts       # requireAuth, requireProgrammeLead, requireTeamLead
├── lib/
│   ├── logger.ts            # pino structured logger
│   ├── auth.ts              # hashPassword, verifyPassword, createSession, getUserFromToken
│   └── activity.ts          # logActivity helper
└── routes/
    ├── index.ts             # Mounts all routers
    ├── auth.ts              # /api/auth/* (login, setup, invite, accept-invite, forgot/reset)
    ├── users.ts             # /api/users (programme_lead-only CRUD + role update)
    ├── programmes.ts        # /api/programmes (get/update programme name)
    ├── streams.ts           # /api/streams (CRUD + stream teams)
    ├── teams.ts             # /api/teams (CRUD, assign-lead, personnel)
    ├── projects.ts          # /api/projects (team-scoped CRUD)
    ├── tasks.ts             # /api/tasks (project-scoped)
    ├── milestones.ts        # /api/milestones (project-scoped)
    ├── events.ts            # /api/events (visibility-filtered: full|shared)
    └── activity.ts          # /api/activity (programme_lead sees all; team_lead sees own)

lib/db/src/schema/
├── users.ts                 # role: "programme_lead" | "team_lead"
├── programmes.ts            # Single programme record (name)
├── streams.ts               # programmeId, name, description
├── teams.ts                 # streamId (nullable), name, functionLabel
├── assigned_personnel.ts    # Non-user personnel per team (name, roleLabel)
├── projects.ts              # teamId, title, status, phase, notes, color, tags, dueDate
├── tasks.ts                 # projectId, status, priority, assignedToUserId | assignedToMemberId
├── milestones.ts            # projectId, title, date, completed
├── events.ts                # internalDescription, sharedDescription, invitedTeamIds
├── event_invitations.ts     # teamId <-> eventId junction
├── sessions.ts              # session tokens
├── invites.ts               # invite tokens (role: programme_lead | team_lead)
└── activity_logs.ts         # CRUD audit trail
```

## Key Concepts

### Team Access Control
- **Programme Lead**: sees all streams, teams, data across programme; team cards are all clickable
- **Team Lead**: sees all streams/team cards for situational awareness; only their own team card is clickable (others show lock icon with status/progress visible but no internal data)

### Events: Cross-Team Sharing
- `internalDescription` — visible only to creator team + programme_lead (visibility: "full")
- `sharedDescription` — visible to all invited teams (visibility: "shared")
- `invitedTeamIds[]` — controls which teams can see the event

### Task Assignment
- `assignedToUserId` (nullable) — links to a registered user
- `assignedToMemberId` (nullable) — links to assigned_personnel (non-user entity)
- Exactly one or neither; TaskItem shows `assignedUserName` / `assignedMemberName`

### Personnel (Members)
- Non-user entities (no login) representing team members not registered in the system
- Created per team by team leads
- Can be assigned to tasks

## API Endpoints
- `POST /api/auth/setup` / `POST /api/auth/login` / `POST /api/auth/logout`
- `POST /api/auth/invite` / `GET /api/auth/invite/:token` / `POST /api/auth/accept-invite`
- `POST /api/auth/forgot-password` / `POST /api/auth/reset-password`
- `GET /api/auth/me` / `GET /api/auth/status`
- `GET /api/users` / `PATCH /api/users/:id/role` / `PATCH /api/users/:id/deactivate` / `DELETE /api/users/:id`
- `GET /api/programmes` / `PATCH /api/programmes/:id`
- `GET/POST /api/streams` / `GET/PATCH/DELETE /api/streams/:id` / `GET /api/streams/:id/teams`
- `GET/POST /api/teams` / `GET/PATCH/DELETE /api/teams/:id` / `POST /api/teams/:id/assign-lead`
- `GET/POST /api/teams/:id/personnel` / `PATCH/DELETE /api/personnel/:id`
- `GET/POST /api/projects` / `GET/PATCH/DELETE /api/projects/:id`
- `GET /api/projects/:id/tasks` / `POST /api/tasks` / `PATCH/DELETE /api/tasks/:id`
- `GET /api/projects/:id/milestones` / `POST /api/milestones` / `PATCH/DELETE /api/milestones/:id`
- `GET/POST /api/events` / `GET/PATCH/DELETE /api/events/:id`
- `GET /api/activity`

## DB Migration
Push schema changes: `pnpm --filter @workspace/db run push`

## Environment Secrets
- `RESEND_API_KEY` — Resend email for invite/password-reset emails
- `SESSION_SECRET` — session creation entropy
- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit DB integration)
- `SETUP_SECRET` — first-run secret to create the programme lead account

## Design Tokens
Colors extend navyDark, navyMid, slate, success alongside standard foreground/background/card/muted/primary/border palette. Supports light/dark mode via useColors hook.
