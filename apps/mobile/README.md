# Eaton LLC Mobile App

A React Native (Expo) mobile app for truck drivers to manage job assignments in the field. Built for M Eaton Trucking LLC as a companion to their existing web dispatch platform.

---

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Environment Setup](#environment-setup)
- [Running the App](#running-the-app)
- [Key Systems](#key-systems)
- [API Contract](#api-contract)
- [Offline Strategy](#offline-strategy)
- [Known Limitations & TODOs](#known-limitations--todos)

---

## Project Overview

Drivers use this app to:

- View job assignments and detailed job info (addresses, foreman, materials)
- Update job status (En Route → On Site → Completed) with offline support
- Clock in/out with live GPS location tracking sent to dispatch
- Submit ticket photos (camera or gallery) by date
- Receive push notifications for new or changed assignments

The app integrates with an existing Django REST backend. Spring 2026 team did not build the backend — see [API Contract](#api-contract) for the endpoints in use.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo (managed workflow) |
| Navigation | Expo Router (file-based) |
| State / Cache | TanStack React Query v5 |
| Offline Persistence | `@tanstack/query-async-storage-persister` + AsyncStorage |
| Auth Token Storage | `expo-secure-store` |
| Location Tracking | `expo-location` + `expo-task-manager` |
| Push Notifications | `expo-notifications` |
| Image Picker | `expo-image-picker` |
| HTTP Client | Axios (with request/response interceptors) |
| Theme System | Custom `ThemeContext` with light/dark support |
| Action Sheets | `@expo/react-native-action-sheet` |

---

## Architecture Overview

```
app/                        ← Expo Router screens (file = route)
├── (auth)/                 ← Login, forgot password (no auth guard)
├── (tabs)/                 ← Main tab navigator (auth-guarded)
│   ├── myjobs.tsx          ← Job list with pull-to-refresh
│   ├── tickets.tsx         ← Ticket photo submission by date
│   ├── notifications.tsx   ← Notification history (placeholder)
│   └── more.tsx            ← Profile, theme toggle, logout
├── job/[id].tsx            ← Job detail + status update
├── more/
│   ├── profiledetails.tsx
│   └── permissions.tsx
└── _layout.tsx             ← Root layout: providers, offline banner, notification handling

contexts/
├── AuthContext.tsx          ← JWT tokens, login/logout, driver role check
└── ClockContext.tsx         ← Clock in/out state, location tracking lifecycle

lib/
├── locationTracking.ts      ← Background GPS task (expo-task-manager)
├── offlineQueue.ts          ← AsyncStorage write queue for offline mutations
├── queryClient.ts           ← Shared QueryClient + AsyncStorage persister
├── statusUpdatePayload.ts   ← Payload builders for status PATCH
├── statusUpdateSync.ts      ← Replays queued status updates on reconnect
├── syncConflicts.ts         ← Detects 400/409 conflict responses
├── theme.ts                 ← Light/dark theme tokens
├── ThemeContext.tsx          ← Theme provider + useTheme hook
└── types.ts                 ← Shared TypeScript types (Job, Driver, Ticket, etc.)

services/
└── api.ts                   ← Axios instance, base URL resolution, token interceptors
```

### Data Flow

```
Screen (useQuery) → React Query Cache → AsyncStorage (persisted)
                                  ↑
                          API call on mount / stale
```

On first load, React Query checks the in-memory cache, then AsyncStorage. If both are empty or stale, it fetches from the API. Screens get instant data from cache while a background refetch runs — drivers never stare at a spinner after the first open.

---

## Project Structure

```
.
├── app/                  ← Screens and layouts (Expo Router)
├── assets/               ← Images, fonts
├── contexts/             ← React context providers
├── docs/                 ← System design docs, API requirements, diagrams
├── lib/                  ← Business logic, utilities, theme
├── services/             ← Axios API client
├── app.json              ← Expo config (permissions, plugins, bundle ID)
├── package.json
└── tsconfig.json
```

---

## Environment Setup

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| Node.js | 18+ | LTS recommended |
| JDK | 17 (Temurin) | Required for Android builds |
| Android Studio | Latest | For the Android emulator |
| Expo CLI | Latest | `npm install -g expo-cli` |

### 1. Clone and install

```bash
git clone <repo-url>
cd Eaton-LLC-MobileApp
npm install
```

### 2. Configure environment

Copy the example file and fill in your values:

```bash
cp .env.example .env
```

```env
EXPO_PUBLIC_API_BASE_URL=http://<your-backend-ip>:8000/api
```

> **Note:** In dev, `services/api.ts` auto-detects your machine IP from Expo's `hostUri` for physical devices. You only need `.env` for production or if auto-detection fails.

### 3. Google Services (Android push notifications)

A `google-services.json` file is required at the project root for Firebase push notifications on Android. Get this from the Firebase console under the `com.eatonllc.partnerapp` project. **Do not commit this file.**

### 4. EAS / Expo account

The project is linked to EAS project ID `1e9bc6a7-8cee-42e2-ad10-9721dd503c78` under the `eaton26` Expo account. The team lead manages EAS credentials.

---

## Running the App

> **Important:** This project uses `expo-location`, `expo-task-manager`, and a custom bundle ID — it is **not compatible with Expo Go**. You must use a development build.

### Android (emulator or physical device)

```bash
npx expo run:android
```

This compiles a native dev build and installs it. You only need to re-run this when you add new native modules. For JS-only changes, the app hot-reloads.

### First-time native build setup

Make sure `ANDROID_HOME` is set and `adb devices` shows your device/emulator before running.

### Viewing logs

Open Android Studio → Logcat, filter by tag `ReactNativeJS`. This shows all `console.log` output from the app.

---

## Key Systems

### Authentication (`contexts/AuthContext.tsx`)

- Login calls `POST /api/login/` and stores JWT access + refresh tokens in `expo-secure-store`
- After login, the app calls `GET /api/drivers/me/` to verify the user is a driver — non-drivers are blocked at login
- The Axios response interceptor in `services/api.ts` automatically refreshes the access token on 401 and retries the original request. If refresh fails, the user is redirected to login
- `app/(tabs)/_layout.tsx` redirects unauthenticated users to login via `<Redirect>`

### Clock In / Out (`contexts/ClockContext.tsx`)

- Shared via `ClockContext` so both `myjobs.tsx` and `tickets.tsx` show the same clock button in their headers
- On clock-in: calls the backend, then calls `startLocationTracking()` to begin background GPS
- On clock-out: stops GPS tracking, then calls the backend
- On app launch: hydrates clock status from `GET /api/drivers/clock-status/` and restarts GPS if already clocked in
- The backend clock endpoint has a multi-attempt fallback strategy in `toggleClockOnBackend()` that tries several HTTP methods and paths to handle backend inconsistencies

### Live Location Tracking (`lib/locationTracking.ts`)

- Uses `expo-task-manager` to define a background task (`background-location-task`) at the module level
- The task is imported in `app/_layout.tsx` so it registers before the app renders — this is required by Expo
- Every 30 seconds, the task fires and PATCHes `PATCH /api/drivers/location/` with lat/lng
- Because background tasks run in a separate JS context, the task cannot use the shared Axios instance — it reads the token directly from `SecureStore` and makes a plain `axios` call
- A pulsing `LIVE` badge appears in the header of My Jobs and Tickets when `isTracking` is true

> **Rebuild required:** Any change to `app.json` permissions, new native modules, or the task definition requires `npx expo run:android` again.

### Offline Queue (`lib/offlineQueue.ts`, `lib/statusUpdateSync.ts`)

The app uses a three-layer offline strategy:

1. **Read:** React Query's persisted cache (AsyncStorage) serves data instantly when offline
2. **Write:** Status updates are enqueued to `EATON_OFFLINE-ACTION-QUEUE` in AsyncStorage when the device is offline
3. **Sync:** `NetInfo` in `app/_layout.tsx` watches for reconnection. On reconnect, `replayQueuedStatusUpdates()` sends queued actions in order

**Conflict handling:** If the backend returns 400/409 (stale state), `syncConflicts.ts` detects it, shows an alert, removes that action from the queue, and continues with remaining actions. Transient failures (5xx) leave the action in the queue for the next reconnect.

### React Query Cache (`lib/queryClient.ts`)

- Single `QueryClient` instance shared across all screens
- Persisted to AsyncStorage via `PersistQueryClientProvider` (in `_layout.tsx`)
- `staleTime: 5 min` — data is served from cache for 5 minutes before background refetch
- `gcTime: 24 hours` — unused cache entries are kept for 24 hours
- Each job detail is cached by `['job', jobId]`, each ticket list by `['tickets', selectedDate]` — switching between items never triggers a spinner if previously loaded

### Theme System (`lib/theme.ts`, `lib/ThemeContext.tsx`)

- Light and dark tokens defined in `lib/theme.ts`
- `ThemeProvider` wraps the root layout and exposes `useTheme()` to all screens
- All styles use `makeStyles(theme)` — a function called inside the component that returns a `StyleSheet` keyed to the current theme
- Mode can be `'light'`, `'dark'`, or `'system'` (default). The toggle in the More screen switches between light and dark

---

## API Contract

The app talks to a Django REST backend. All requests include `Authorization: Bearer <token>` via the Axios request interceptor.

### Endpoints in use

| Method | Path | Screen |
|---|---|---|
| `POST` | `/api/login/` | Login |
| `POST` | `/api/token/refresh/` | Auto-refresh interceptor |
| `GET` | `/api/drivers/me/` | Profile, login role check |
| `GET` | `/api/drivers/me/jobs/` | My Jobs |
| `GET` | `/api/drivers/clock-status/` | ClockContext hydration |
| `POST` | `/api/drivers/clock-in/` | Clock in |
| `POST` | `/api/drivers/clock-out/` | Clock out |
| `PATCH` | `/api/drivers/location/` | Background location task |
| `GET` | `/api/jobs/:id/` | Job Detail |
| `PATCH` | `/api/job-driver-assignments/:id/status/` | Status update |
| `PATCH` | `/api/job-driver-assignments/:id/backhaul-status/` | Backhaul status |
| `GET` | `/api/tickets/?date=YYYY-MM-DD` | Tickets screen |
| `POST` | `/api/tickets/` | Ticket photo submission (multipart) |
| `POST` | `/api/devices/` | Push token registration |
| `POST` | `/api/auth/password-reset/` | Forgot password step 1 |
| `POST` | `/api/auth/password-reset/verify/` | Forgot password step 2 |
| `POST` | `/api/auth/password-reset/confirm/` | Forgot password step 3 |

For full request/response shapes, see `docs/backend-api-requirements.md`.

---

## Offline Strategy

See `docs/MANUAL_CONFLICT_TEST.md` for a step-by-step runbook to manually verify that:
- Offline status updates queue correctly
- They sync on reconnect
- Conflicts (dispatcher changed status while driver was offline) show an alert and drop only the conflicting action
- Transient failures (5xx) stay queued for retry

---

## Known Limitations & TODOs

| Item | Notes |
|---|---|
| Job map preview | Google Static Maps API identified as the approach. Deferred due to billing setup. | See if client is interested
| Foreground-only tracking fallback | If background location permission is denied, tracking is skipped entirely. Could fall back to foreground-only. |
| Ticket offline queue | Photo submissions are not queued offline — they fail silently if submitted without connection. Same pattern as status updates could be applied. |
| Notifications screen | Currently a placeholder. Notification history is not yet fetched from the backend. |
| iOS build | Never tested on a physical iOS device in Spring 2026. `app.json` iOS config is present but untested end-to-end. |
| Token expiry on background task | The background location task reads the token at fire time. If the token expired while the device was idle, the ping is silently dropped. |
