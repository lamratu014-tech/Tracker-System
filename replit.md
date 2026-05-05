# Ops & Planning — Programme Operations & Planning Platform

## Overview
Mobile Expo app (React Native) for organisations to manage a Stream → Team → Project → Milestone hierarchy plus a separate Events calendar. **Local-first**: all data lives in a Zustand global store persisted to AsyncStorage. The mobile app does not call the API server.

The Express + PostgreSQL API server in `artifacts/api-server` is retained but not used by mobile.

## Architecture

### Stack
- **Runtime**: Expo SDK 54, expo-router v6, React Native 0.81
- **State**: Zustand global store with `persist` middleware (AsyncStorage); persist key `ops-planning-store-v2`
- **Auth**: Real email login + 6-character invite-code activation
- **Fonts**: @expo-google-fonts/inter (400/500/600/700)
- **Icons**: @expo/vector-icons (Feather)

### Roles (3 login tiers + non-login members)
- **admin** — Full access across the whole programme
- **stream_overseer** — Full access to all teams within their assigned stream
- **leader** — Manage their own team only
- **(member)** — NOT a login role. Members are roster-only entries on a team (top-level `members[]`)

### Permission helpers (`store/useStore.ts`)
- `canManageEverything(user)` — admin only
- `canManageStream(user, streamId)` — admin OR stream_overseer of that stream
- `canManageTeam(user, teamId, streams)` — admin OR overseer of containing stream OR leader of that team
- `canCreateForTeam(user, teamId, streams)` — same as above; programme-wide creation requires admin
- React hooks: `useCurrentUser()`, `useCanManageStream(streamId)`, `useCanManageTeam(teamId)`

### Hierarchy
```
Streams → Teams → Projects → Milestones
Members are top-level, scoped to a team
Each Team has its own Notes timeline (TeamNote[] on Team)
Events are separate, optionally linked to a stream OR team
```

### Auth flow
1. Admin invites a user via `/new-user` → store generates a 6-char code, sets `active: false`
2. Invitee opens `/accept-invite`, enters the code → account is activated and signed in
3. Subsequent logins use email at `/login`
4. Demo emails (all active): admin@ops.test · pat@ops.test · jess@ops.test · morgan@ops.test

### App Structure
```
artifacts/mobile/app/
├── _layout.tsx              # AuthGate; PUBLIC_ROUTES: /login, /accept-invite
├── login.tsx                # Email login
├── accept-invite.tsx        # 6-char invite code activation
├── new-user.tsx             # Invite a new user → shows generated code
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
