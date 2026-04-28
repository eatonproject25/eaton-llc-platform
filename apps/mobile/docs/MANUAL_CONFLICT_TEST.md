# Manual Conflict Test: Offline Queue vs Admin Override

## Goal
Verify that when a driver queues a status update while offline and a dispatcher changes the same assignment on the web, the mobile app:
- shows a conflict alert when sync resumes,
- drops only the conflicting queued action, and
- keeps other retryable queued actions for later sync.

## Scope
This runbook validates mobile offline sync behavior for status updates sent to:
- `PATCH /api/job-driver-assignments/{id}/status/`

Conflict responses expected from backend:
- `400` invalid transition
- `409` stale/outdated assignment state

## Preconditions
- Mobile app is running from branch `feature/manual-conflict-test`.
- Driver user can access at least one assignment in My Jobs.
- Dispatcher user can modify the same assignment in admin/web.
- Mobile and backend point to the same environment.

## Test Data
- Assignment ID: `<ASSIGNMENT_ID>`
- Initial assignment status: `<INITIAL_STATUS>`
- Driver offline target status: `<DRIVER_STATUS>`
- Dispatcher override status: `<DISPATCHER_STATUS>`

Example values:
- Initial: `Assigned`
- Driver offline target: `En Route`
- Dispatcher override: `Completed`

## Steps
1. Open the mobile app as the driver and navigate to the target job.
2. Put the mobile device/emulator offline (airplane mode or disable network).
3. Change the assignment status on mobile to `<DRIVER_STATUS>`.
4. Confirm the app accepts the action while offline (queued locally).
5. Without bringing mobile online, open admin/web as dispatcher.
6. Change the same assignment to `<DISPATCHER_STATUS>` and save.
7. Bring the mobile device back online.
8. Wait for sync to run automatically.

## Expected Results
- A mobile alert appears:
  - Title: `Sync Conflict`
  - Message indicates the offline status update was rejected and user should re-check the job.
- The conflicting queued action is removed from local queue.
- Jobs query is refreshed and mobile reflects server status.
- No infinite retry loop for the conflicting action.

## Retryable Failure Check
Validate queue preservation for non-conflict failures.

1. Queue a status update while offline.
2. Bring device online, but force a transient backend failure (for example, stop backend briefly or return `503`).
3. Confirm no conflict alert is shown.
4. Confirm queued action is still present and retries on next reconnect.

Expected:
- Retryable failures stay queued.
- Queue is not fully cleared unless each action is resolved.

## Evidence to Capture
- Screenshot of conflict alert.
- Before/after queue state from local storage inspection (if available).
- Backend request/response logs showing `400` or `409`.
- Final assignment status shown in mobile and web.

## Pass/Fail Criteria
Pass when all are true:
- Conflict alert is shown for `400` or `409`.
- Conflicting action is removed from queue.
- Non-conflict failures remain queued for retry.
- Mobile shows backend-authoritative assignment status after sync.

Fail if any are true:
- Queue is entirely cleared after transient failures.
- Conflict action keeps retrying forever.
- Mobile status diverges from server after reconnect.
