# Frontend Security Review

## Overview
This report documents a frontend security review for the mobile app deliverable: Conduct security review (token storage, API auth, encryption).

Review scope focused on:
- Token storage and lifecycle handling
- Authenticated API request flow
- Offline/local storage usage
- Transport security configuration

### Verification Approach
The review was performed by directly inspecting frontend implementation files and auth-related tests in this repository, including:
- [contexts/AuthContext.tsx](contexts/AuthContext.tsx#L34)
- [services/api.ts](services/api.ts#L5)
- [lib/offlineQueue.ts](lib/offlineQueue.ts#L13)
- [lib/queryClient.ts](lib/queryClient.ts#L25)
- [app/_layout.tsx](app/_layout.tsx#L74)
- [__tests__/services/api.test.ts](__tests__/services/api.test.ts#L40)
- [__tests__/context/AuthContext.test.tsx](__tests__/context/AuthContext.test.tsx#L68)

## Token Storage Review
Current implementation:
- Access and refresh tokens are stored in Expo SecureStore, not AsyncStorage, via [contexts/AuthContext.tsx](contexts/AuthContext.tsx#L50) and [contexts/AuthContext.tsx](contexts/AuthContext.tsx#L51).
- Stored access token is checked on app launch to restore authenticated state in [contexts/AuthContext.tsx](contexts/AuthContext.tsx#L34).
- Tokens are removed on explicit logout in [contexts/AuthContext.tsx](contexts/AuthContext.tsx#L91) and [contexts/AuthContext.tsx](contexts/AuthContext.tsx#L92).
- Tokens are also removed when refresh flow fails in [services/api.ts](services/api.ts#L62) and [services/api.ts](services/api.ts#L63).
- During non-driver login rejection, tokens are deleted after role check in [contexts/AuthContext.tsx](contexts/AuthContext.tsx#L66).

Security observations:
- No token storage in AsyncStorage was found.
- No direct console logging of tokens/passwords was found in application code.
- Error handling returns user-facing generic messages in login and forgot-password flows, which reduces accidental sensitive leakage.

Risk level: Low

Recommendation:
- Keep token storage in SecureStore as implemented.
- Add a regression test for the non-driver branch currently marked todo in [__tests__/context/AuthContext.test.tsx](__tests__/context/AuthContext.test.tsx#L146) to ensure token cleanup always remains enforced.

## API Authentication Review
Current implementation:
- All API calls in app screens use the shared axios instance [services/api.ts](services/api.ts#L14).
- Request interceptor reads access token from SecureStore and adds Authorization Bearer header in [services/api.ts](services/api.ts#L27).
- Response interceptor handles 401, attempts refresh using refresh token, stores new access token, retries request, and clears tokens on refresh failure in [services/api.ts](services/api.ts#L51) and [services/api.ts](services/api.ts#L57).
- Existing tests verify header attachment, token refresh, token deletion, and redirect behavior in [__tests__/services/api.test.ts](__tests__/services/api.test.ts#L40) and [__tests__/services/api.test.ts](__tests__/services/api.test.ts#L84).

Security observations:
- No hardcoded bearer tokens were found.
- No direct unauthenticated fetch patterns were found in app code for protected endpoints; screens consistently call the shared api client.
- Refresh endpoint call uses global axios in [services/api.ts](services/api.ts#L51), which is acceptable for this specific flow but bypasses shared client defaults like timeout/interceptor chain.

Risk level: Low

Recommendation:
- Keep centralized auth through the shared api instance.
- Optionally standardize refresh request behavior (for example dedicated refresh client config) so timeout and error handling are explicitly consistent.

## Offline / Local Storage Review
Current implementation:
- Offline queue is stored in AsyncStorage using key EATON_OFFLINE-ACTION-QUEUE in [lib/offlineQueue.ts](lib/offlineQueue.ts#L8).
- Queue payload currently contains assignmentId, status, expectedStatus, and metadata in [lib/offlineQueue.ts](lib/offlineQueue.ts#L13).
- React Query cache is persisted to AsyncStorage with key EATON_QUEARY_CACHE in [lib/queryClient.ts](lib/queryClient.ts#L27), wired in [app/_layout.tsx](app/_layout.tsx#L74).

Security observations:
- No tokens or passwords were found stored in AsyncStorage.
- Offline queue data appears operational and non-credential.
- Persisted query cache may include driver/job data (for example addresses, contact fields, profile/job payloads) because the entire cache is serialized to AsyncStorage in [lib/queryClient.ts](lib/queryClient.ts#L25).

Risk level: Medium

Recommendation:
- Keep auth tokens in SecureStore (already correct).
- Reduce persisted surface in AsyncStorage by setting selective persistence, shorter cache retention, or excluding sensitive query keys where practical.
- Document expected local data classification for persisted cache and align it with project privacy requirements.

## Encryption / Transport Security Review
Current implementation:
- API base URL is environment-driven with fallback to http localhost in [services/api.ts](services/api.ts#L5).
- All auth and API requests use this base URL through the axios client in [services/api.ts](services/api.ts#L15).

Security observations:
- Local development fallback uses HTTP localhost, which is common for emulator/local backend development.
- Production transport security depends on EXPO_PUBLIC_API_BASE_URL configuration; the frontend does not enforce HTTPS-only by itself.
- If production is misconfigured to HTTP, credentials and tokens could be exposed in transit.

Risk level: Medium

Recommendation:
- Enforce HTTPS in production environment configuration and deployment checks.
- Add a startup guard (or CI config validation) that rejects non-HTTPS API URL values outside local development.

## Risk Summary Table
| Area | Current Implementation | Risk | Recommendation |
| --- | --- | --- | --- |
| Token Storage | Access/refresh tokens are stored and deleted via SecureStore lifecycle handlers | Low | Keep current pattern; add test coverage for non-driver rejection cleanup |
| API Authentication | Shared axios client adds Bearer token; refresh and retry flow implemented; cleanup on refresh failure | Low | Keep centralized client usage; optionally formalize refresh client behavior |
| Offline / Local Storage | Offline queue and persisted React Query cache are stored in AsyncStorage | Medium | Limit persisted data scope/retention and classify cached data sensitivity |
| Encryption / Transport Security | Base URL uses env var with HTTP localhost fallback | Medium | Enforce HTTPS in production and validate config during build/release |

## Recommendations
1. Keep SecureStore-based token storage and existing cleanup behavior as implemented.
2. Add missing auth regression test for non-driver login rejection path in [__tests__/context/AuthContext.test.tsx](__tests__/context/AuthContext.test.tsx#L146).
3. Review persisted React Query keys and exclude or minimize sensitive profile/job fields from AsyncStorage persistence where feasible.
4. Add production configuration control to require HTTPS API base URL.
5. Continue avoiding sensitive token/password logging; current implementation is aligned with this practice.

## Conclusion
The frontend implementation demonstrates a generally sound security posture for token storage and API authentication: tokens are handled in SecureStore, bearer token attachment is centralized, and failed refresh paths clear credentials.

Primary improvement opportunities are configuration hardening for transport security in production and reducing sensitive exposure in AsyncStorage-persisted query data. These are medium-risk hardening items rather than critical implementation failures.