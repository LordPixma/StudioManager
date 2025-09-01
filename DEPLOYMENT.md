# Studio Manager SaaS Deployment Guide

> Deprecation (2025-09-01): Legacy proxying via `API_ORIGIN` and Cloudflare Tunnels has been removed. All `/api/*` endpoints are now served directly by the Cloudflare Worker. Remove any remaining tunnel/proxy configs.

## Cloudflare Workers (Full stack: static + API on Workers)

### Migration checklist: remove legacy tunnels/proxy

Use this when decommissioning Cloudflare Tunnels (or any legacy API proxy) after moving to the Workers-native API.

- Inventory
    - List active tunnels and mapped hostnames.
    - Note any DNS records that point traffic to the tunnel.

- Disable and delete tunnel (on the old API host)
    - Stop service: macOS (brew): `brew services stop cloudflared`; Linux (systemd): `sudo systemctl stop cloudflared`.
    - Remove DNS route: `cloudflared tunnel route dns delete <tunnel-name> <hostname>` or delete the DNS record in Cloudflare dashboard.
    - Delete tunnel: `cloudflared tunnel delete <tunnel-name>`.
    - Clean local config: remove `~/.cloudflared/config.yml` and tunnel credentials JSON.

- Repo/config cleanup
    - `wrangler.toml`: ensure `API_ORIGIN` is removed (done) and Durable Object migrations are present.
    - Worker code: proxy fallback removed (done). Unknown `/api/*` returns 404.
    - Vite dev proxy: remove or point to `wrangler dev` if you keep a dev proxy.
    - Frontend env: prefer same-origin; `VITE_API_URL` can be unset or set to `/api`.

- Observability and ops
    - Update monitoring checks to hit the Worker route (health: `/api/health`, readiness: `/api/readiness`).
    - Remove alerts targeting the tunnel hostname.
    - Rotate or remove any secrets no longer used by the legacy backend.

- Verification
    - GET `/api/health` -> 200.
    - GET `/api/readiness` -> `{ db: 'ok' }`.
    - Auth flow: register → login → session.
    - CRUD smoke: customers create/list/update/delete.
    - Optional: rooms/bookings conflict path, staff CRUD, reports CSV.

This repo includes a Cloudflare Worker at `worker/index.ts` that serves the React build from `dist` and implements the API natively on Workers. Data is stored in Cloudflare D1, and booking conflict control uses Durable Objects.

### Configure

1) Build frontend
```
npm run build
```

2) Configure environment variables
```
You can set variables in wrangler.toml under `[vars]`, or via secrets:

Required:
- NODE_ENV=production
- JWT_SECRET (set via `wrangler secret put JWT_SECRET`)

Optional (dev): create a .dev.vars file with KEY=VALUE lines
# .dev.vars
NODE_ENV=development
```

If you see EACCES errors writing Wrangler logs on macOS, fix directory ownership:

```
sudo chown -R "$USER":staff "$HOME/Library/Preferences/.wrangler"
chmod -R u+rwX "$HOME/Library/Preferences/.wrangler"
```
```

3) Apply D1 schema (first time only)
```
wrangler d1 execute stm-prod-01 --file .\\migrations\\d1\\schema.sql --remote
```

4) Publish
```
wrangler deploy
```

The Worker will:
- Serve static assets from `dist` via the `ASSETS` binding
- Serve API under `/api/*` directly (no external proxy)
- Provide SPA fallback to `/index.html` for non-file routes

Note: ensure your backend CORS allows the Worker’s domain if cookies are used.

---

## Cloudflare Pages (Frontend)

### 1. Connect Repository
1. Go to Cloudflare Pages dashboard
2. Click "Create a project"
3. Connect to your GitHub repository: `LordPixma/StudioManager`

### 2. Configure Build Settings
- **Framework preset**: Custom
- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (leave empty if repo root)

### 3. Environment Variables (Cloudflare Pages)
Add these build-time environment variables in Cloudflare Pages (Project → Settings → Environment variables):
```
NODE_ENV=production
# IMPORTANT: include the /api suffix, as the backend serves under /api
VITE_API_URL=https://your-api-domain.com/api
```

### 4. Custom Domain (Optional)
- Add your custom domain in the "Custom domains" section
- Update DNS to point to your Cloudflare Pages deployment

## Notes on legacy backends

Earlier versions referenced proxying to a separate Flask API via `API_ORIGIN` and Cloudflare Tunnels. That path has been removed. The application is now fully serverless on Cloudflare (Workers + D1 + Durable Objects). If you still operate a legacy backend, treat it as deprecated; no proxying remains in the Worker.

## Database Migration

### From Single-Tenant to Multi-Tenant

If migrating existing data:

```sql
-- Add tenant_id columns to existing tables
ALTER TABLE customers ADD COLUMN tenant_id INTEGER;
ALTER TABLE users ADD COLUMN tenant_id INTEGER;

-- Create default tenant
INSERT INTO tenants (name, subdomain, plan, is_active) 
VALUES ('Default Studio', 'default', 'premium', true);

-- Update existing records with default tenant
UPDATE customers SET tenant_id = 1;
UPDATE users SET tenant_id = 1;

-- Add constraints
ALTER TABLE customers ADD CONSTRAINT fk_customers_tenant 
    FOREIGN KEY (tenant_id) REFERENCES tenants(id);
```

## Production Checklist
---

## Troubleshooting
- Health: `GET /api/health` → `{ status: 'healthy' }`
- Readiness: `GET /api/readiness` → `{ db: 'ok' }`
- 404 on unknown API routes is expected; proxying is removed.


### Security
- [ ] Use strong SECRET_KEY
- [ ] Enable HTTPS only
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable CSP headers

### Performance
- [ ] Configure database connection pooling
- [ ] Set up CDN for assets
- [ ] Enable gzip compression
- [ ] Optimize bundle size

### Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Configure logging
- [ ] Set up health checks
- [ ] Monitor database performance

### Backup
- [ ] Automated database backups
- [ ] Test restoration procedures
- [ ] Document recovery process

## Development Workflow

### Local Development
- Start vite dev server: `npm run dev`
- If testing the Worker locally, use `wrangler dev` to run the Worker and serve assets/API.
- Access at: http://localhost:5173 (vite) or the wrangler dev URL

### Staging Deployment
1. Push to `staging` branch
2. Automatic deployment to staging environment
3. Run integration tests

### Production Deployment
1. Create PR to `main` branch
2. Review and approve changes
3. Merge triggers production deployment
4. Monitor deployment and health checks

## Frontend build variables (recap)

- Build command: `npm run build`
- Output directory: `dist`
- Environment variables:
   - `NODE_ENV=production`
   - `VITE_API_URL` optional; defaults to same-origin `/api`

## Post-deploy smoke checklist (Pages + API)

1) Frontend
- Visit your Pages URL. Confirm index loads (200) and assets load without console errors.
- Verify redirects: direct-link to a route (e.g., /dashboard) loads via SPA fallback.

2) CORS + cookies
- In the browser devtools Network tab, try hitting a protected flow (login/register).
- Confirm requests include `Cookie` and responses set `Set-Cookie`.
- Check cookie flags: `Secure`, `HttpOnly`, `SameSite=None` in production.

3) API endpoints
- Registration flow: create an account; expect 201 and user in response.
- Login: expect success and session established; call `/api/session` to verify.
- Customers list: `/api/customers` returns data or empty list without errors.

4) Security headers
- Inspect a response; confirm `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` present.

5) Backend readiness
- `GET /api/readiness` returns `{ db: "ok" }`.
- D1 schema applied successfully; errors should be 0.