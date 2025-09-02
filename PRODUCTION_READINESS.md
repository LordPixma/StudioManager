# Production Readiness Review

Date: 2025-08-31
Scope: Workers API + React/Vite frontend + Cloudflare (Workers, D1, Durable Objects)

## Executive summary

Status: Serverless deployment live on Cloudflare. Continue hardening around tests, observability, and optional features.

Top areas to harden next:
1) Keep D1 schema aligned with the API. `migrations/d1/schema.sql` is the source of truth; apply via `wrangler d1 execute`.
2) Expand automated tests (register/login, customers CRUD, bookings conflict path, staff, reports CSV).
3) Observability: add error tracking (Sentry) and minimal request logging.
4) Tenant routing: validate subdomain strategy in production and document overrides.
5) Backups: schedule D1 exports and restoration drills.

## Findings and recommendations

### 1) Data model and migrations
- Use `migrations/d1/schema.sql` to evolve the schema. For changes, generate a follow-up SQL and apply remotely.
- Ensure indices support frequent queries (customers search, bookings by date range, etc.).

### 2) Auth and cookies
- JWT stored in httpOnly SameSite=Lax cookie; same-origin API means minimal CORS complexity.
- Rotate `JWT_SECRET` via `wrangler secret` when needed.

### 3) API completeness and contract
- Endpoints implemented in Worker: auth, tenants, customers, rooms, bookings (DO conflict safety), staff, and CSV reports.
- Unknown `/api/*` return 404 since proxying was removed.

### 4) Frontend integration
- Frontend client should call same-origin `/api`. If using a different host, set `VITE_API_URL` accordingly.
- Keep axios with `withCredentials: true` for cookie flows.

### 5) Security headers and rate limiting
- Worker sets CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Consider rate limiting (e.g., per-IP KV counter) for login and write-heavy endpoints.

### 6) Monitoring and logging
- Add Sentry (Workers SDK) or simple error logging with request IDs.
- Maintain `/api/health` and `/api/readiness` checks.

### 7) Runtime
- Workers provide horizontal scale; Durable Objects serialize per-room booking creation.
- No container tuning required.

### 8) Configuration and secrets
- Manage via `wrangler.toml` `[vars]` and `wrangler secret`.
- Avoid committing secrets.

### 9) Tests and CI/CD
- Add GitHub Actions to run vitest, type-check, eslint, and any Worker integration tests.

### 10) Data backup and DR
- Export D1 backups periodically; verify restoration to a fresh D1 instance.

## Migration validation status (D1)
- Target DB: Cloudflare D1. Schema at `migrations/d1/schema.sql`.
- Applied to production via `wrangler d1 execute`.
- Issue: No centralized logging or error tracking.

- Actions:
	- Bind R2 for avatars: add [[r2_buckets]] AVATARS in wrangler.toml; endpoints: POST /api/users/me/avatar, GET /api/r2/avatars/:key. Keep CSP img-src allowing https: and data:.
