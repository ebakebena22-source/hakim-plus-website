# Hakim Plus Diaspora Customer Portal

React/Vite frontend for the Hakim Plus public site, customer portal, and role-restricted pharmacy operations workspace.

## Local development

1. Copy `.env.example` to `.env.local`.
2. Set `VITE_API_BASE_URL` to the HTTPS origin of the Hakim Plus API.
3. Run `npm install` and `npm run dev`.

When no API URL is configured, authenticated features fail closed with a configuration message. Authentication, authorization, payment confirmation, secure uploads, audit logging, rate limiting, encryption, backups, and cross-account isolation must be implemented and enforced by the production backend.

## Verification

Run `npm run check` before deployment. This performs linting, architecture/privacy contract tests, and a production build. The test suite deliberately checks admin-only governance routes, payment idempotency headers, third-party tracking removal, analytics data minimization, and hosting security headers.

The full backend and end-to-end test suite must additionally cover registration, login/reset, cross-account access denial, beneficiary/request/file permissions, quote expiry and modification, provider webhook verification, duplicate-charge/order prevention, fulfillment/delivery, notifications, reordering, account deletion, and every staff role.

## Production deployment

`vercel.json` provides SPA rewrites, conservative browser security headers, no-store HTML, and immutable hashed-asset caching for Vercel. If deploying elsewhere, reproduce these headers at the CDN or reverse proxy and update `connect-src` only for the exact production API origin. Do not relax `frame-ancestors`, add third-party behavioral trackers to authenticated routes, or expose prescription uploads through public URLs.

Before launch, configure and verify:

- HTTPS, secure cookies, CSRF protection, server-side RBAC and object ownership checks
- private file storage, short-lived download URLs, type/size validation and malware scanning
- idempotent payment attempts and signed provider webhooks
- append-only audit logs, error monitoring with sensitive-data redaction, rate limits and lockout controls
- encrypted backups and a documented restore test
- keyboard and mobile end-to-end checks against the real backend

Deployment itself is intentionally not automated here because production hosting, API, identity, storage, payment, monitoring, and DNS credentials have not been provided.
