# StudioManager - SaaS

A comprehensive multi-tenant SaaS web application for managing fitness, music, dance, or any multi-room studios. Built with a React frontend and a Cloudflare Workers API (serverless) backed by Cloudflare D1.

## Features

### 🏢 Multi-Tenant SaaS Architecture
- **Tenant Isolation**: Complete data separation between different studios/organizations
- **Subdomain Support**: Each tenant gets their own subdomain (coming soon)
- **Flexible Plans**: Free, Basic, Premium, and Enterprise tiers
- **Self-Service Registration**: Studios can sign up and start using the platform immediately

### 👥 User Management
- **Role-Based Access Control**: Admin, Studio Manager, Staff/Instructor, Receptionist
- **Permission System**: Granular permissions for different actions
- **Multi-Studio Support**: Users can be assigned to specific studios within a tenant

### 📋 Core Studio Management
- **Customer Database**: Comprehensive customer information management
- **Room Booking System**: Schedule and manage room reservations
- **Staff Scheduling**: Assign staff to sessions and track availability
- **Reporting & Analytics**: Performance insights and business metrics

### 🔒 Security & Compliance
- **Secure Authentication**: Session-based auth with JWT token support
- **Data Encryption**: All sensitive data encrypted at rest and in transit
- **GDPR Compliant**: Privacy-focused design with data portability

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for modern, responsive design
- **React Router** for client-side routing
- **TanStack Query** for efficient data fetching
- **Zustand** for state management
- **React Hook Form** with Zod validation

### Backend
- **Cloudflare Workers** API
- **Cloudflare D1** (SQLite-compatible) for persistence
- **Durable Objects** for booking conflict control
- JWT auth via httpOnly cookie

### Deployment
- **Cloudflare Workers** serves both static assets and the API
- **Cloudflare D1** for the database

## Breaking changes

- Proxying to a separate Flask API and Cloudflare Tunnel guidance has been removed.
- All APIs are implemented in the Worker under `/api/*`.

## Quick Start

### Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/LordPixma/StudioManager.git
   cd StudioManager
   ```

2. **Install dependencies**
   ```bash
   # Frontend dependencies
   npm install
   
   # Backend dependencies
   pip install -r requirements.txt
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Database Setup**
   ```bash
   # Initialize database
   flask db init
   flask db migrate -m "Initial migration"
   flask db upgrade
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Start React development server
   npm run dev
   
   # Terminal 2: Start Flask API server
   python run.py
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Production Deployment

#### Cloudflare Workers (Full stack)
The Worker serves the frontend from `dist` and implements the API at `/api/*`.

1. Build frontend: `npm run build`
2. Secrets and vars:
   - `wrangler secret put JWT_SECRET`
   - `NODE_ENV=production` (wrangler.toml `[vars]`)
3. Apply D1 schema (first deploy): `wrangler d1 execute <db-name> --file .\\migrations\\d1\\schema.sql --remote`
4. Deploy: `wrangler deploy`
5. Visit the Worker URL

If you hit macOS permission errors writing Wrangler logs, fix ownership:
```
sudo chown -R "$USER":staff "$HOME/Library/Preferences/.wrangler"
chmod -R u+rwX "$HOME/Library/Preferences/.wrangler"
```

Notes:
- Proxying to a legacy API has been removed. The app is now fully serverless on Cloudflare.

## Development

### Available Scripts

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint code
npm run lint:fix     # Fix linting issues

# Worker
wrangler dev         # Run the Worker locally (serves assets + API)
wrangler deploy      # Deploy the Worker
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests and linting
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Roadmap

### Phase 1: Core SaaS Conversion ✅
- [x] React frontend with modern tooling
- [x] Multi-tenant database architecture
- [x] Workers-based API
- [x] Authentication and user management
- [x] Customer management with tenant isolation

### Phase 2: Enhanced Features (Coming Soon)
- [ ] Complete booking system with calendar
- [ ] Staff scheduling and session management
- [ ] Payment processing integration
- [ ] Email notifications and reminders
- [ ] Advanced reporting and analytics

### Phase 3: Enterprise Features
- [ ] Subdomain routing
- [ ] Advanced role management
- [ ] API rate limiting
- [ ] Webhook integrations
- [ ] Mobile apps (React Native)
- [ ] Advanced security features

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, email [support@studiomanager.app](mailto:support@studiomanager.app) or create an issue on GitHub.

## Database & Migrations (Postgres-first)

See Production Readiness: `PRODUCTION_READINESS.md` → “Migration validation status (Postgres-first)”.

- Use Postgres for migrations/staging/production. SQLite can be brittle for complex batch ops.
- Keep Alembic revision IDs short (VARCHAR(32) limitation in alembic_version).
- Always set `DATABASE_URL` when running migrations/seeds to avoid accidental SQLite writes.

Quick commands (zsh):
```
DATABASE_URL=postgresql://studio_user:studio_pass@localhost:54329/studio_manager \
   FLASK_APP=run.py flask db upgrade

DATABASE_URL=postgresql://studio_user:studio_pass@localhost:54329/studio_manager \
   FLASK_APP=run.py flask seed

export DATABASE_URL=postgresql://studio_user:studio_pass@localhost:54329/studio_manager
export FLASK_APP=run.py
```