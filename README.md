# StudioManager

Multi-tenant studio management SaaS. Serverless on Cloudflare (Workers + D1 + Durable Objects) with a React/Vite frontend.

## Features

- Customers: create, view, edit, delete with tenant isolation
- Rooms: CRUD + capacity/rates; bookings with conflict safety (Durable Objects)
- Staff: directory and role/permission management
- Reports: CSV exports (bookings, revenue)
- Auth: JWT in httpOnly cookie, same-origin API

## Architecture

- API: Cloudflare Workers (`worker/index.ts`)
- Data: Cloudflare D1 (schema at `migrations/d1/schema.sql`)
- Concurrency control: Durable Object `RoomLock`
- Frontend: React + Vite (built to `dist/`, served by the Worker)

## Breaking changes

- Proxying to legacy backends and Cloudflare Tunnels has been removed.
- All API routes are now served directly by the Cloudflare Worker under `/api/*`.

## Quick start

1) Install deps
```
npm install
```

2) Build frontend
```
npm run build
```

3) Configure secrets/vars
```
wrangler secret put JWT_SECRET
# wrangler.toml already sets NODE_ENV=production under [vars]
```

4) Apply D1 schema (first deploy only)
```
wrangler d1 execute <your-d1-name> --file .\migrations\d1\schema.sql --remote
```

5) Deploy
```
wrangler deploy
```

## Local development

- Run the Worker locally (serves assets + API):
```
wrangler dev
```

- Or use Vite for UI-only iteration:
```
npm run dev
```

Note: When using Vite dev server, API calls to `/api/*` expect the Worker to be running separately (or adjust proxy as needed for your setup).

## Testing

- Worker smoke tests (vitest):
```
npm run test:worker
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes with tests
4. Open a pull request
