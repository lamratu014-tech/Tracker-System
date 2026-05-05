# Ops & Planning — Unified Operations & Planning Platform

## Overview
A mobile Expo app (React Native) for organisations to manage operations, events, projects, and tasks — all in one place with security, role management, and audit logging.

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native
- **Storage**: AsyncStorage (encrypted with AES-256-GCM via Web Crypto API)
- **Fonts**: @expo-google-fonts/inter (Inter 400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)
- **State**: React Context (Auth, Audit, Data)

### App Structure
```
artifacts/mobile/
├── app/
│   ├── _layout.tsx          # Root layout; provider chain
│   ├── (tabs)/
│   │   ├── _layout.tsx      # Bottom tab navigator (Dashboard/Calendar/Projects/Settings)
│   │   ├── index.tsx        # Dashboard with Project/Calendar focus toggle + widgets
│   │   ├── calendar.tsx     # Monthly calendar + event list with milestone sync
│   │   ├── projects.tsx     # Project list + task management
│   │   └── settings.tsx     # User profile, user switcher, admin shortcut, prefs
│   ├── admin/
│   │   ├── _layout.tsx      # Admin area layout + auth guard
│   │   └── index.tsx        # Admin panel: Users / Audit Log / Settings tabs
│   ├── event/[id].tsx       # Event detail screen
│   ├── project/[id].tsx     # Project detail + milestone management
│   ├── new-event.tsx        # New event modal
│   └── new-project.tsx      # New project modal
├── context/
│   ├── AuthContext.tsx      # User/role management, 5 seed users, safe defaults
│   ├── AuditContext.tsx     # Audit log (decoupled from AuthContext)
│   └── DataContext.tsx      # Events/Projects/Tasks/Milestones with encrypted storage
├── services/
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
```

### Provider Chain (order matters)
```
SafeAreaProvider
  ErrorBoundary
    QueryClientProvider
      AuthProvider         ← useAuth() returns safe defaults if outside context
        AuditProvider      ← decoupled from AuthContext (no useAuth call)
          DataProvider     ← useData() returns safe defaults if outside context
            GestureHandlerRootView
              KeyboardProvider
                Stack (expo-router)
```

### Key Design Decisions

**Encryption**: AES-256-GCM via `crypto.subtle` (Web Crypto API available in Hermes + browsers). Key stored in expo-secure-store on native (hardware-backed), AsyncStorage on web. Graceful fallback to plain JSON if crypto unavailable.

**Seed Data**: Controlled by `SEEDED_KEY = "ops_seeded_v2"` in AsyncStorage. Seed runs exactly once on first install. Subsequent loads read from encrypted storage.

**Milestone ↔ Calendar Sync**: Adding/updating a milestone auto-creates/updates a linked CalendarEvent with `milestoneId` field. Completing or deleting a milestone removes the linked event.

**Audit Log**: `AuditContext` is independent — `log()` takes userId/userName as params so any component can log without depending on AuthContext directly.

**Admin Guard**: `app/admin/_layout.tsx` redirects non-admin users to root.

## Features
- **Dashboard**: Widget-based with Project Focus / Calendar Focus toggle, stat cards, active projects, upcoming milestones, tasks due, activity feed
- **Calendar**: Monthly calendar with event dots (colour-coded), daily event list, milestone auto-synced events
- **Projects**: Project list with status, progress, phase; drill into tasks and milestones
- **Settings**: User profile, demo user switcher, admin panel shortcut, calendar preferences
- **Admin Panel**: User management with role changes, audit log viewer, GDPR/DPA 2018 notice
- **Security**: AES-256-GCM encryption at rest, audit trail, role-based access (admin/manager/viewer)

## Storage Keys
All stored with `_v2` suffix to isolate from any legacy data:
- `ops_events_v2` — encrypted calendar events
- `ops_projects_v2` — encrypted projects
- `ops_tasks_v2` — encrypted tasks
- `ops_milestones_v2` — encrypted milestones
- `ops_seeded_v2` — first-run flag (plain string "1")
- `ops_aes_key_v1` — AES master key (base64, in SecureStore or AsyncStorage)
- `ops_users_v1` — user list (plain JSON)
- `ops_current_user_v1` — active user ID (plain string)
- `ops_audit_log_v1` — audit entries (plain JSON, max 500)

## Workflows
- `artifacts/mobile: expo` — Expo dev server (Metro bundler, port from $PORT env var)
- `artifacts/api-server: API Server` — Express API server

## Known Behaviours
- **Hot-reload blank screen**: Expo Metro's fast refresh causes a brief blank during code rebundling — this is normal and not a bug in the app code.
- **Deprecation warnings**: `shadow*` style props and `props.pointerEvents` are React Native Web deprecation warnings (cosmetic, no functional impact).
