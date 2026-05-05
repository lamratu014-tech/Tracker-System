# Ops & Planning — Unified Operations & Planning Platform

## Overview
A mobile Expo app (React Native) for organisations to manage operations, events, projects, and tasks — with a fully server-backed, role-based system with strict data isolation, teams, assigned personnel, cross-team events with dual descriptions, and backend-enforced permissions.

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native
- **API Server**: Express 5 + PostgreSQL via Drizzle ORM
- **Auth**: bcryptjs password hashing, 64-char hex session tokens in DB, Resend for invite emails
- **Fonts**: @expo-google-fonts/inter (Inter 400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)
- **State**: React Context (AuthContext, DataContext) — all API-backed, no local storage

### Roles (3 tiers)
- **admin** — Full system access, user management, all teams
- **team_leader** — Manage own team's data (projects, tasks, milestones, events, personnel)
- **owner** — View own team's data, approve milestones, update phase/notes only

### App Structure
```
artifacts/mobile/
├── app/
│   ├── _layout.tsx          # Root layout; AuthProvider > DataProvider > AuthGate redirect
│   ├── login.tsx            # Sign-in / first-run admin setup screen
│   ├── accept-invite.tsx    # Accept invite link → set name+password → auto-login
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom tab navigator (Dashboard/Calendar/Projects/Settings)
│   │   ├── index.tsx        # Dashboard with Project/Calendar focus toggle + widgets
│   │   ├── calendar.tsx     # Monthly calendar + event list
│   │   ├── projects.tsx     # Project list by status
│   │   └── settings.tsx     # User profile (shows team, role), admin shortcut, sign-out
│   ├── admin/
│   │   ├── _layout.tsx      # Admin area layout + auth guard
│   │   └── index.tsx        # Admin panel: Users / Teams / Activity / Settings tabs
│   ├── event/[id].tsx       # Event detail: visibility-aware (full vs shared)
│   ├── project/[id].tsx     # Project detail + role-gated edit actions + task/milestone tabs
│   ├── new-event.tsx        # New event modal: internal + shared descriptions, team invites
│   └── new-project.tsx      # New project modal: team selector + metadata
├── context/
│   ├── AuthContext.tsx      # API-backed auth: login/logout/setup/invite/role mgmt
│   └── DataContext.tsx      # API-backed: Teams, Personnel, Projects, Tasks, Milestones, Events, Activity
├── services/
│   ├── api.ts               # Typed fetch wrapper for all API calls; token stored in SecureStore/localStorage
│   └── encryption.ts        # AES-256-GCM (legacy, kept for backward compat)
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
├── lib/
│   ├── logger.ts            # pino structured logger
│   ├── auth.ts              # hashPassword, verifyPassword, createSession, getUserFromToken
│   ├── session.ts           # Session middleware (requireAuth, requireAdmin, requireTeamLeader)
│   └── activity.ts          # logActivity helper
└── routes/
    ├── index.ts             # Mounts all routers
    ├── auth.ts              # /api/auth/* (login, setup, invite, accept-invite, forgot/reset-password)
    ├── users.ts             # /api/users (admin-only CRUD + role update)
    ├── teams.ts             # /api/teams (CRUD, assign-leader, assign-owner, personnel)
    ├── projects.ts          # /api/projects (team-scoped CRUD)
    ├── tasks.ts             # /api/tasks (project-scoped, assignedToUserId OR assignedToMemberId)
    ├── milestones.ts        # /api/milestones (project-scoped, owner can toggle completed)
    ├── events.ts            # /api/events (visibility-filtered: full|shared)
    └── activity.ts          # /api/activity (admin-only audit log)

lib/db/
├── schema/                  # Drizzle schema tables
│   ├── users.ts             # id, email, name, initials, role (admin|team_leader|owner), teamId, active
│   ├── teams.ts             # id, name, functionLabel
│   ├── assigned_personnel.ts # Non-user personnel per team (name, roleLabel)
│   ├── projects.ts          # teamId, title, description, status, phase, notes, color, tags, dueDate
│   ├── tasks.ts             # projectId, status, priority, assignedToUserId OR assignedToMemberId
│   ├── milestones.ts        # projectId, title, date, completed
│   ├── events.ts            # internalDescription, sharedDescription, invitedTeamIds[]
│   ├── event_invitations.ts  # teamId <-> eventId junction
│   ├── sessions.ts          # session tokens
│   └── activity_logs.ts     # CRUD audit trail
└── index.ts                 # DB client export
```

## Key Concepts

### Data Isolation
- Each team only sees their own projects, tasks, milestones, and personnel
- Admin can see all data across all teams
- API enforces isolation — no frontend-only checks

### Events: Cross-Team Sharing
- `internalDescription` — visible only to creator team + admin (visibility: "full")
- `sharedDescription` — visible to all invited teams (visibility: "shared")
- `invitedTeamIds[]` — controls which teams can see the event
- EventCard and event detail screen adapt display based on `visibility` field

### Task Assignment
- `assignedToUserId` (nullable) — links to a registered user
- `assignedToMemberId` (nullable) — links to an assigned_personnel (non-user entity)
- Exactly one or neither; TaskItem shows `assignedUserName` / `assignedMemberName`

### Personnel
- `assigned_personnel` — non-user entities (no auth) representing team members not in the system
- Created and managed by team leaders per team
- Can be assigned to tasks

## API Endpoints
- `POST /api/auth/setup` — first-run admin creation
- `POST /api/auth/login` / `POST /api/auth/logout`
- `POST /api/auth/invite` / `GET /api/auth/invite/:token` / `POST /api/auth/accept-invite`
- `POST /api/auth/forgot-password` / `POST /api/auth/reset-password`
- `GET /api/auth/me` / `GET /api/auth/status`
- `GET /api/users` / `PATCH /api/users/:id/role` / `PATCH /api/users/:id/deactivate` / `DELETE /api/users/:id`
- `GET/POST /api/teams` / `GET/PATCH/DELETE /api/teams/:id`
- `POST /api/teams/:id/assign-leader` / `POST /api/teams/:id/assign-owner`
- `GET/POST /api/teams/:id/personnel` / `PATCH/DELETE /api/personnel/:id`
- `GET/POST /api/projects` / `GET/PATCH/DELETE /api/projects/:id`
- `GET /api/projects/:id/tasks` / `GET/POST /api/tasks` / `PATCH/DELETE /api/tasks/:id`
- `GET /api/projects/:id/milestones` / `GET/POST /api/milestones` / `PATCH/DELETE /api/milestones/:id`
- `GET/POST /api/events` / `GET/PATCH/DELETE /api/events/:id`
- `GET /api/activity`

## DB Migration
Push schema changes: `pnpm --filter @workspace/db run push`

## Environment Secrets
- `RESEND_API_KEY` — Resend email for invite/password-reset emails
- `SESSION_SECRET` — used in session creation entropy
- `DATABASE_URL` — PostgreSQL connection string (auto-provided by Replit DB integration)
- `SETUP_SECRET` — first-run secret to create the admin account

## Design Tokens
Colors extend navyDark, navyMid, slate, success alongside standard foreground/background/card/muted/primary/border palette. Supports light/dark mode via useColors hook.
