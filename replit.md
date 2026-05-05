# Ops & Planning — Unified Operations & Planning Platform

## Overview
A mobile Expo app (React Native) for organisations to manage operations, events, projects, and tasks — all in one place with real server-backed authentication, role management, and audit logging.

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native
- **API Server**: Express 5 + PostgreSQL via Drizzle ORM
- **Auth**: bcryptjs password hashing, 64-char hex session tokens in DB, Resend for invite emails
- **Local Storage**: AsyncStorage (encrypted with AES-256-GCM via Web Crypto API)
- **Fonts**: @expo-google-fonts/inter (Inter 400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)
- **State**: React Context (Auth, Audit, Data)

### App Structure
```
artifacts/mobile/
├── app/
│   ├── _layout.tsx          # Root layout; provider chain + AuthGate redirect
│   ├── login.tsx            # Sign-in screen (also shows "Create Admin" on first run)
│   ├── accept-invite.tsx    # Accept invite link → set name+password → auto-login
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom tab navigator (Dashboard/Calendar/Projects/Settings)
│   │   ├── index.tsx        # Dashboard with Project/Calendar focus toggle + widgets
│   │   ├── calendar.tsx     # Monthly calendar + event list with milestone sync
│   │   ├── projects.tsx     # Project list + task management
│   │   └── settings.tsx     # User profile, admin shortcut, sign-out
│   ├── admin/
│   │   ├── _layout.tsx      # Admin area layout + auth guard
│   │   └── index.tsx        # Admin panel: Users / Audit Log / Settings tabs
│   ├── event/[id].tsx       # Event detail screen
│   ├── project/[id].tsx     # Project detail + milestone management
│   ├── new-event.tsx        # New event modal
│   └── new-project.tsx      # New project modal
├── context/
│   ├── AuthContext.tsx      # API-backed auth: login/logout/setup/invite/role mgmt
│   ├── AuditContext.tsx     # Audit log (decoupled from AuthContext)
│   └── DataContext.tsx      # Events/Projects/Tasks/Milestones with encrypted storage
├── services/
│   ├── api.ts               # Typed fetch wrapper for all API calls; token stored in SecureStore
│   ├── encryption.ts        # AES-256-GCM via Web Crypto API; expo-secure-store on native
│   └── audit.ts             # Audit types, severity helper, ID generator
├── components/
│   ├── EventCard.tsx
│   ├── ProjectCard.tsx
│   ├── TaskItem.tsx
│   └── StatusBadge.tsx
├── hooks/
│   └── useColors.ts         # Light/dark palette from constants/colors.ts
└── constants/
    └── colors.ts            # Design tokens (navyDark, navyMid, slate added)

artifacts/api-server/src/
├── app.ts                   # Express app, CORS, pino-http, /api router
├── index.ts                 # Listens on $PORT
├── lib/
│   ├── logger.ts            # pino structured logger
│   ├── auth.ts              # hashPassword, verifyPassword, createSession, getUserFromToken
│   └── email.ts             # Resend integration; graceful fallback when key absent
├── middlewares/
│   └── requireAuth.ts       # Bearer token → req.authUser; requireAdmin checks role
└── routes/
    ├── health.ts            # GET /healthz
    ├── auth.ts              # /auth/status /auth/setup /auth/login /auth/logout
    │                          /auth/invite /auth/accept-invite /auth/invite/:token
    ├── users.ts             # GET /users; PATCH role/deactivate/reactivate; DELETE
    └── index.ts             # Mounts all routers

lib/db/src/schema/
├── users.ts                 # usersTable (id, email, name, initials, dept, role, passwordHash, active)
├── invites.ts               # invitesTable (token, email, role, dept, expiresAt, usedAt)
├── sessions.ts              # sessionsTable (token, userId FK, expiresAt — 30 day)
└── index.ts                 # Re-exports all schemas
```

### Provider Chain (order matters)
```
SafeAreaProvider
  ErrorBoundary
    QueryClientProvider
      AuthProvider         ← API-backed; returns safe defaults if outside context
        AuditProvider      ← decoupled from AuthContext
          DataProvider     ← local encrypted storage
            GestureHandlerRootView
              KeyboardProvider
                AuthGate   ← redirects unauthenticated → /login
                  Stack (expo-router)
```

### Auth Flow

**First Run (no users in DB)**
1. Mobile calls `GET /api/auth/status` → `{ needsSetup: true }`
2. Login screen shows "Create Admin Account" form
3. Admin submits name/email/password → `POST /api/auth/setup`
4. Server creates admin user, returns session token + user
5. Token stored in expo-secure-store; redirects to tabs

**Normal Login**
1. `POST /api/auth/login` with email + password
2. Server verifies bcrypt hash; creates session (30-day expiry)
3. Token stored in expo-secure-store

**Invite Flow**
1. Admin → Admin Panel → Users → Invite button
2. Fills name, email, role, department → `POST /api/auth/invite`
3. Server creates invite token (72hr); sends email via Resend
4. Recipient taps link → opens accept-invite screen (deep link via URL)
5. `GET /api/auth/invite/:token` validates token, returns pre-filled email/name
6. User sets name + password → `POST /api/auth/accept-invite`
7. User created, session token returned, auto-logged in

**Session Persistence**
- Token stored in `expo-secure-store` (hardware-backed on native)
- On app launch: `GET /api/auth/me` with stored token to restore session
- Logout: `POST /api/auth/logout` deletes session from DB + clears local token

### Key Design Decisions

**Encryption**: AES-256-GCM via `crypto.subtle` (Web Crypto API). Key stored in expo-secure-store on native. Used for local event/project/task/milestone data only — auth moves fully to the server.

**Resend fallback**: If `RESEND_API_KEY` is not set, the invite link is logged server-side (warn level) and also returned in the API response so the admin can share it manually.

**Seed Data**: Controlled by `SEEDED_KEY = "ops_seeded_v2"` in AsyncStorage. Runs once on first install for local data only; user accounts come from the DB.

**Milestone ↔ Calendar Sync**: Adding/updating a milestone auto-creates/updates a linked CalendarEvent. Completing or deleting a milestone removes the linked event.

**Audit Log**: `AuditContext` is independent — `log()` takes userId/userName as params.

**Admin Guard**: `app/admin/_layout.tsx` redirects non-admin users to root.

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/healthz | — | Health check |
| GET | /api/auth/status | — | `{ needsSetup: bool }` |
| POST | /api/auth/setup | — | Create first admin (fails if users exist) |
| POST | /api/auth/login | — | Email + password login |
| POST | /api/auth/logout | Bearer | Invalidate session |
| GET | /api/auth/me | Bearer | Current user profile |
| POST | /api/auth/invite | Admin | Send invite email + create token |
| GET | /api/auth/invite/:token | — | Validate invite token |
| POST | /api/auth/accept-invite | — | Accept invite, create account |
| GET | /api/users | Bearer | List all users |
| PATCH | /api/users/:id/role | Admin | Change user role |
| PATCH | /api/users/:id/deactivate | Admin | Deactivate user |
| PATCH | /api/users/:id/reactivate | Admin | Reactivate user |
| DELETE | /api/users/:id | Admin | Permanently delete user |

## Environment Variables / Secrets
- `DATABASE_URL` — PostgreSQL connection (Replit-managed)
- `RESEND_API_KEY` — Resend email API key (secret)
- `PORT` — assigned per-service by Replit workflows
- `EXPO_PUBLIC_DOMAIN` — Replit dev domain for API URL construction

## Features
- **Real Authentication**: bcrypt passwords, server sessions, 30-day token expiry
- **First-Run Setup**: "Create Admin Account" screen when no users exist
- **Invite Flow**: Admin sends invite email via Resend → recipient sets password → auto-login
- **Dashboard**: Widget-based with Project Focus / Calendar Focus toggle, stat cards
- **Calendar**: Monthly calendar with event dots, daily event list, milestone sync
- **Projects**: Project list with status, progress; drill into tasks and milestones
- **Settings**: User profile, admin shortcut, Sign Out button
- **Admin Panel**: Invite users, role management, audit log viewer, GDPR notice
- **Security**: AES-256-GCM local encryption, bcrypt auth, session tokens, RBAC

## Local Storage Keys
- `ops_events_v2` — encrypted calendar events
- `ops_projects_v2` — encrypted projects
- `ops_tasks_v2` — encrypted tasks
- `ops_milestones_v2` — encrypted milestones
- `ops_seeded_v2` — first-run flag (plain string "1")
- `ops_aes_key_v1` — AES master key (base64, in SecureStore or AsyncStorage)
- `ops_audit_log_v1` — audit entries (plain JSON, max 500)
- `ops_session_token` — auth session token (in SecureStore on native)

## Workflows
- `artifacts/mobile: expo` — Expo dev server (Metro bundler, port from $PORT env var)
- `artifacts/api-server: API Server` — Express 5 API server (port from $PORT env var)
