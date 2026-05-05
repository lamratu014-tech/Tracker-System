# Ops & Planning — Programme Operations & Planning Platform

## Overview
A mobile Expo app (React Native) for organisations to manage a Stream → Team → Project → Milestone hierarchy plus a separate Events calendar. **Local-first**: all data lives in a Zustand global store persisted to AsyncStorage on the device. There are no backend reads or writes from the mobile app.

The Express + PostgreSQL API server in `artifacts/api-server` is retained in the repo but is no longer called by the mobile app. It can be removed in a future cleanup pass if not needed.

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native 0.81
- **State**: Zustand global store with `persist` middleware (AsyncStorage backend)
- **Auth**: Profile-select login — pick a user from the seeded list; selection persists. No password, no email.
- **Fonts**: @expo-google-fonts/inter (400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)

### Roles (3 tiers)
- **admin** — Full access: create/edit/delete streams, teams, users, all projects/milestones/events
- **leader** — Manage own team only: create/edit projects, milestones, and events scoped to their team
- **member** — Read-only across visible content; no creation. The "+" hub is hidden for members.

### Permission helpers (`store/useStore.ts`)
- `canManageEverything(user)` — admin only
- `canManageTeam(user, teamId)` — admin OR leader of that team
- `canCreateForTeam(user, teamId)` — admin OR leader for the matching team

### Hierarchy
```
Streams (e.g. Marketing, Operations)
└── Teams (e.g. Brand & Creative)
    └── Projects (e.g. Spring Campaign)
        └── Milestones (status: pending | in_progress | blocked | completed; deadline; overdue calc)

Events (separate)
└── Linked optionally to a stream OR team (or programme-wide)
```

### App Structure
```
artifacts/mobile/
├── app/
│   ├── _layout.tsx              # Root layout; AuthGate redirects based on currentUserId + hydration
│   ├── login.tsx                # Profile picker — tap a user to sign in
│   ├── (tabs)/
│   │   ├── _layout.tsx          # 4-tab bar: Dashboard / Programme / Calendar / Settings
│   │   ├── index.tsx            # Dashboard: stat tiles + Overdue + Due Today + Upcoming Events; "+" FAB
│   │   ├── programme.tsx        # Collapsible streams (only one open) → teams
│   │   ├── calendar.tsx         # Chronological events with Upcoming/Past/All filter
│   │   └── settings.tsx         # Profile card, role chip, sign-out, admin shortcut, reset to seed
│   ├── admin/
│   │   ├── _layout.tsx          # Admin guard (role === "admin")
│   │   └── index.tsx            # Three tabs: Structure / Users / Events with full CRUD
│   ├── stream/[id].tsx          # Stream detail: rename, delete, list teams, add team
│   ├── team/[id].tsx            # Team detail: rename, delete, assign leader, list projects + members
│   ├── project/[id].tsx         # Project detail: edit, delete, milestone list with status pills
│   ├── event/[id].tsx           # Event detail with delete (admin or creator)
│   ├── new-stream.tsx           # Modal — admin only
│   ├── new-team.tsx             # Modal — admin only; pick stream + optional leader
│   ├── new-user.tsx             # Modal — admin only; name + role + optional team
│   ├── new-project.tsx          # Modal — admin/leader; pick team
│   ├── new-milestone.tsx        # Modal — admin/leader; pick project + status + deadline chips
│   └── new-event.tsx            # Modal — admin/leader; date/time chips + linked team
├── components/
│   ├── CreateActionSheet.tsx    # Bottom sheet "+" hub with role-gated options
│   ├── MilestoneRow.tsx         # Status pill cycler + overdue highlight + delete
│   ├── ErrorBoundary.tsx        # Kept from scaffold
│   ├── ErrorFallback.tsx        # Kept from scaffold
│   └── KeyboardAwareScrollViewCompat.tsx  # Kept from scaffold
├── store/
│   └── useStore.ts              # Zustand store: state, actions (try/catch wrapped), permission helpers,
│                                # lookup helpers (findStream/Team/Project), useCurrentUser hook,
│                                # AsyncStorage persistence under key "ops-planning-store-v1"
├── models/
│   └── types.ts                 # User, Stream, Team, Project, Milestone, AppEvent, isOverdue()
├── hooks/
│   └── useColors.ts             # Light/dark palette
└── constants/
    └── colors.ts                # Design tokens
```

## "+" System Creation Hub
On the Dashboard, a floating "+" FAB (hidden for members) opens a bottom sheet with role-gated options:
- **admin**: Stream, Team, User, Project, Milestone, Event
- **leader**: Project, Milestone, Event (scoped to their team)
- **member**: hidden

Each option pushes a modal screen (`new-*.tsx`) that writes via a store action and dismisses on success.

## Persistence & Reset
- All store state (users, currentUserId, streams, events) is persisted to AsyncStorage on every change
- On app launch the store rehydrates and `hydrated` flips to true; the AuthGate waits on this before routing
- Settings → "Reset to seed data" wipes everything and re-seeds (admin only)

## Seed Data
The store seeds 5 users (1 admin, 2 leaders, 2 members), 2 streams (Marketing, Operations), 2 teams, 2 projects, 3 milestones, and 1 upcoming event so the app is demonstrable on first launch.

## Design Tokens
Colors come from `constants/colors.ts` via the `useColors` hook. Inter font family throughout. Feather icons.

## Removed in this rebuild
- `context/AuthContext`, `context/DataContext`, `context/AuditContext` (replaced by Zustand store)
- `services/api.ts`, `services/encryption.ts`, `services/audit.ts` (no API calls)
- `app/accept-invite.tsx`, `app/forgot-password.tsx`, `app/reset-password.tsx` (no email/password auth)
- `components/AddUserModal.tsx`, `components/TaskItem.tsx`, `components/EventCard.tsx`, `components/ProjectCard.tsx`, `components/StatusBadge.tsx` (replaced by `MilestoneRow` + inline rendering)
- `@tanstack/react-query` provider (no remote data)

## Environment
The Express API server still references `RESEND_API_KEY` and `SESSION_SECRET` but the mobile app does not consume any environment secrets.
