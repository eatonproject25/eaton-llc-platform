# Backend API Requirements — M4 Sprint

This document summarizes what the mobile frontend has already built and what the backend needs to provide for the app to be fully functional. Written for the backend dev.

---

## Current State of the Mobile App

### What is done on mobile:
- Login screen — sends `POST /api/login/` with `{ username, password }`
- Token storage — access + refresh tokens stored securely on device
- Auto token refresh — if a request gets a 401, mobile automatically calls `/api/token/refresh/` and retries
- Driver role check on login — after login, mobile calls `GET /api/drivers/` and checks if the logged-in user is a driver. Non-drivers are blocked with "Access denied."
- Forgot password — full 3-step OTP flow is built and wired up (see section below)
- My Jobs screen — UI is built with mock data, ready to be connected to real API
- Job Detail screen — UI is built with mock data, ready to be connected to real API
- My Profile screen — placeholder screen, ready for real data
- Tab auth guard — unauthenticated users are redirected to login automatically

### What is NOT done on mobile (waiting on backend):
- My Jobs screen showing real data from `GET /api/drivers/me/jobs/`
- My Profile screen showing real data from `GET /api/drivers/me/`
- Job status updates via `PATCH /api/job-driver-assignments/{id}/status/`
- Issue reporting via `POST /api/jobs/{id}/report-issue/`
- Push notifications

---

## Priority 1 — Password Reset (SMTP) — BLOCKING

The full forgot password UI is already built on mobile. It calls these 3 endpoints in order:

### Step 1 — Send OTP
```
POST /api/auth/password-reset/
```
Request body:
```json
{ "email": "driver@example.com" }
```
Expected behavior:
- Generate a 6-digit OTP code
- Send it to the provided email via SMTP
- Return `200 OK` on success (mobile doesn't use the response body)
- Return any non-2xx status on failure (mobile shows "Could not send reset code")

### Step 2 — Verify OTP
```
POST /api/auth/password-reset/verify/
```
Request body:
```json
{ "email": "driver@example.com", "code": "123456" }
```
Expected behavior:
- Verify the OTP is valid and not expired
- Return `200 OK` if valid (mobile advances to step 3)
- Return `400` if invalid or expired (mobile shows "Invalid or expired code")

### Step 3 — Confirm New Password
```
POST /api/auth/password-reset/confirm/
```
Request body:
```json
{
  "email": "driver@example.com",
  "code": "123456",
  "new_password": "NewPassword123"
}
```
Expected behavior:
- Verify OTP again, then update the user's password
- Return `200 OK` on success (mobile navigates back to login)
- Return any non-2xx on failure (mobile shows "Something went wrong")

**SMTP Setup needed:** Configure Django email backend with your SMTP provider in `settings.py`:
```python
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'  # or your provider
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = 'your-email@gmail.com'
EMAIL_HOST_PASSWORD = 'your-app-password'  # use app password, not account password
```
Store credentials in `.env`, not hardcoded.

---

## Priority 2 — Add IsAuthenticated to All ViewSets — BLOCKING EVERYTHING

Currently all endpoints are public (`AllowAny`). This needs to be fixed before M4 ships.

Add to every ViewSet the mobile uses:
```python
from rest_framework import permissions

class DriverViewSet(ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
```

ViewSets to update: `DriverViewSet`, `JobViewSet`, `JobDriverAssignmentViewSet`, `DriverTruckAssignmentViewSet`

**Note:** The mobile already sends the Bearer token on every request automatically via a request interceptor. So adding `IsAuthenticated` won't break anything on the mobile side.

---

## Priority 3 — Driver Me Endpoints

### GET /api/drivers/me/
Returns the authenticated driver's own record. Mobile uses this for the My Profile screen.

Expected response:
```json
{
  "id": 8,
  "name": "driver_test1",
  "email_address": "",
  "phone_number": "",
  "driver_license": "",
  "contact_info": "",
  "address": "",
  "truck_count": 1,
  "created_at": "2026-02-17T03:17:09.717086Z",
  "user": 16,
  "operator": 1
}
```

### GET /api/drivers/me/jobs/
Returns jobs currently assigned to the authenticated driver. Mobile uses this for the My Jobs and Schedule screens.

Supported query params (optional):
- `?date=YYYY-MM-DD` — filter by specific date
- `?upcoming=true` — only return jobs on or after today

Expected response — array of Job objects:
```json
[
  {
    "id": 1,
    "job_number": "J-001",
    "project": "Highway 14 Expansion",
    "job_date": "2026-03-05",
    "shift_start": "07:00",
    "material": "Sand",
    "loading_address": { "city": "Mankato" },
    "job_foreman_name": "John Smith",
    "job_foreman_contact": "5071234567"
  }
]
```

**Note:** Mobile currently uses mock data that matches exactly this structure. Once the endpoint is ready, the mobile dev just swaps the mock for the real API call.

---

## Priority 4 — Job Status Updates

### PATCH /api/job-driver-assignments/{id}/status/
Request body:
```json
{ "status": "en_route" }
```
Valid status values: `assigned`, `en_route`, `on_site`, `completed`

Expected response:
```json
{ "status": "en_route" }
```

Requirements:
- Only the driver who owns the assignment can update it (return `403` otherwise)
- Track `started_at` when status changes to `en_route`
- Track `completed_at` when status changes to `completed`

---

## Priority 5 — Issue Reporting

### POST /api/jobs/{id}/report-issue/
Request body:
```json
{
  "issue_type": "equipment",
  "description": "Truck has a flat tire"
}
```
Valid issue types: `equipment`, `safety`, `access`, `material`, `other`

Expected response: `201 Created` with the created issue object.

---

## Priority 6 — Push Notifications

### POST /api/devices/
Registers the device's push token. Mobile calls this once after login.

Request body:
```json
{
  "token": "ExponentPushToken[xxxxxx]",
  "platform": "android"
}
```

When a `JobDriverAssignment` is created, send a push notification to the driver's device token via the Expo Push API:
```
POST https://exp.host/--/api/v2/push/send
{
  "to": "ExponentPushToken[xxxxxx]",
  "title": "New Job Assigned",
  "body": "Job #J-001 on Mar 10",
  "data": { "jobId": 1 }
}
```

---

## API Base URL

Mobile connects to the backend via:
```
EXPO_PUBLIC_API_BASE_URL=http://<your-local-ip>:8000/api
```

Set this in the `.env` file at the root of the mobile repo. Use your machine's local IP (not `localhost`) when testing on a physical device or emulator.

---

## Summary — What to Build First

| Priority | Task | Blocks |
|----------|------|--------|
| 1 | SMTP setup + password reset endpoints | Forgot password flow |
| 2 | Add `IsAuthenticated` to all ViewSets | Security + all authenticated calls |
| 3 | `GET /api/drivers/me/` | My Profile screen |
| 3 | `GET /api/drivers/me/jobs/` | My Jobs + Schedule screens |
| 4 | `PATCH /api/job-driver-assignments/{id}/status/` | Job status buttons |
| 5 | `POST /api/jobs/{id}/report-issue/` | Issue reporting |
| 6 | Device token + push notifications | Push alerts |
