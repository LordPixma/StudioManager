# Production Readiness Review

Date: 2025-08-31
Scope: Full-stack (Flask API + React/Vite frontend) + Docker + Cloudflare Pages

## Executive summary

Status: Not production-ready. There are critical blockers in database migrations vs models, auth/session/CORS configuration, and missing feature routes and frontend API client files.

Top 5 blockers:
1) Migrations out-of-sync with models (multi-tenancy not migrated). Models reference `Tenant`, `tenant_id` FKs and unique constraints that do not exist in Alembic migrations. Seed script also conflicts with current models.
2) CORS + session cookie misconfiguration. A preflight handler adds wildcard headers conflicting with credentialed requests. Cookies likely won’t persist cross-site without SameSite=None.
3) Missing backend routes (rooms/staff/reports) and frontend API client (`src/lib/api`) referenced but not present—build and app flow will fail.
4) Secrets/config. `SECRET_KEY` defaults to `change-me`. No clear `.env`/secrets management, session store not configured.
5) Docker/Deploy. Dev-forward `docker-compose`, single-process Gunicorn, no health/readiness checks at infra level, no non-root user, no `.dockerignore`.

## Findings and recommendations

### 1) Data model and migrations (CRITICAL)
- Issue: Migrations define early single-tenant tables; models implement multi-tenant (`Tenant`, `tenant_id` on many tables, composite unique constraints). Running with Postgres will fail or produce schema drift.
- Actions:
  - Regenerate Alembic migrations to match current models, including:
    - `tenants` table and indexes.
    - Add `tenant_id` to `users`, `customers`, `studios`, `rooms`, `bookings` with FK constraints.
    - Composite unique constraints: `('tenant_id','email')` on `users` and `customers`.
    - Add practical indexes on FKs and common filters: `users.tenant_id`, `customers.(tenant_id,studio_id)`, `bookings.(tenant_id,room_id,start_time,end_time)`.
  - Decide on migration strategy for existing data (DEPLOYMENT.md has a start; expand and test on staging).
  - Fix `run.py` seed: it creates `Studio(name=...)` without `tenant_id` (required) and user rows without `tenant_id`.

### 2) Auth, sessions, and CORS (CRITICAL)
- Issue: `flask_cors` configured but `before_request` returns `Access-Control-Allow-Origin: *` for OPTIONS. With `supports_credentials=True`, wildcard is invalid; cookies won’t send. Also `SESSION_COOKIE_SAMESITE` not set for cross-site frontend (Cloudflare Pages domain) → cookies may be dropped.
- Actions:
  - Remove the manual OPTIONS handler and rely on `flask_cors` config only.
  - Configure allowed origins via environment (e.g., `CORS_ORIGINS=https://app.example.com,https://*.pages.dev`). Avoid wildcard when using credentials.
  - Set `SESSION_COOKIE_SAMESITE='None'` and ensure HTTPS (`SESSION_COOKIE_SECURE=True`) in production.
  - Consider server-side sessions (Redis-backed) for revocation and size limits (Flask-Session).
  - If remaining session-based, add CSRF protection for state-changing requests (double-submit token or per-request header).
  - Alternatively move to stateless JWT in Authorization header; tighten CORS accordingly.

### 3) API completeness and contract (CRITICAL)
- Issue: `app/rooms/routes.py`, `app/staff/routes.py`, `app/reports/routes.py` are stubs. Frontend references these features. Tests for these areas are empty.
- Actions:
  - Implement endpoints or remove frontend references until ready.
  - Add minimal test coverage before exposing in production.

### 4) Frontend integration (HIGH)
- Issue: Frontend imports `../lib/api` (`authAPI`, `customerAPI`), but `src/lib/api` does not exist in the repo. Build and runtime will fail.
- Actions:
  - Add `src/lib/api.ts` (axios instance with `baseURL = import.meta.env.VITE_API_URL || '/api'`, `withCredentials: true`) and typed method wrappers used across pages.
  - Ensure Pages env `VITE_API_URL` points to the API domain; remove hard-coded dev proxy assumptions in production.
  - Consider turning off public source maps in production (keep hidden if needed).

### 5) Security headers and rate limiting (HIGH)
- Issue: No CSP/headers hardening. No rate limiting.
- Actions:
  - Add `Flask-Talisman` or set headers manually: CSP (default-src 'self' your-frontend domain, api domain), HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
  - Add `Flask-Limiter` with Redis storage to protect auth and write endpoints.

### 6) Logging, monitoring, and tracing (HIGH)
- Issue: No centralized logging or error tracking.
- Actions:
  - Configure structured JSON logs (logfmt or JSON) with request IDs. Output to stdout for container platforms.
  - Add Sentry or OpenTelemetry for error tracking and traces.
  - Keep `/api/health` (present). Add readiness endpoint checking DB connectivity.

### 7) Gunicorn and process model (MEDIUM)
- Issue: Default Gunicorn args in Dockerfile (1 worker). No graceful timeouts or threads.
- Actions:
  - Provide a `gunicorn.conf.py` (workers = 2–4, threads = 2, timeout ~ 60–120, keepalive). Make tunable via env.
  - Consider a pre-fork model with `--worker-tmp-dir /dev/shm` in container to avoid disk I/O.

### 8) Docker and Compose (MEDIUM)
- Issue: Dev-forward compose (volumes, FLASK_ENV=development). Image lacks non-root user and `.dockerignore`.
- Actions:
  - Add `.dockerignore` to reduce image size and leakage.
  - Run as non-root in Dockerfile, install build deps then clean up; optionally multi-stage build.
  - Provide a prod compose or deployment manifests with secrets and no bind mounts.

### 9) Configuration and secrets (MEDIUM)
- Issue: `SECRET_KEY` fallback and mixed settings. `python-dotenv` present but `.env.example` missing.
- Actions:
  - Add `.env.example` and load secrets via environment in production (do not commit `.env`).
  - Externalize `CORS_ORIGINS`, `SESSION_COOKIE_SAMESITE`, `DATABASE_URL`, `REDIS_URL`, `GUNICORN_WORKERS`, etc.

### 10) Tests and CI/CD (MEDIUM)
- Issue: Tests exist only for auth; others are stubs. No CI.
- Actions:
  - Add unit/integration tests for customers (tenant isolation), bookings (conflicts), tenants (RBAC), and basic happy-path for each route.
  - Add GitHub Actions: run `pytest`, backend lint, TypeScript typecheck, ESLint, and `vite build` on PRs.

### 11) Data backup and DR (LOW)
- Actions: Ensure automated Postgres backups, tested restore, and migration playbooks. For Redis sessions, persistent store not required, but resilience plan needed.

## Quick configuration deltas to make production safer
- Backend config:
  - SECRET_KEY: Strong random secret in env.
  - SESSION_COOKIE_SECURE=True, SESSION_COOKIE_HTTPONLY=True, SESSION_COOKIE_SAMESITE='None' (if cross-site).
  - Configure CORS with specific origins list; remove manual `OPTIONS` handler.
  - Use Redis-backed sessions; add rate limiting.
- Gunicorn: workers/threads/timeouts tuned; graceful shutdown enabled.
- Docker: `.dockerignore`, non-root user, slim image.

## Suggested immediate next steps (sequenced)
1) Fix schema: write/verify Alembic migration to match current models; adjust `run.py` seed for tenants.
2) Correct CORS/session settings and add server-side sessions; verify cookie flow end-to-end from Cloudflare Pages domain.
3) Restore missing `src/lib/api.ts` and implement any missing backend routes or remove frontend calls.
4) Add security headers and rate limiting.
5) Add CI checks and minimal test coverage for critical flows.
6) Add gunicorn config and redeploy with multiple workers.

## Artifacts added by this review
- `.env.example` with required variables
- `gunicorn.conf.py` with safe defaults (tunable via env)
- `.dockerignore` for tighter images and faster builds

