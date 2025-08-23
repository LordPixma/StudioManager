# Studio Manager SaaS Deployment Guide

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

### 3. Environment Variables
Add these environment variables in Cloudflare Pages:
```
NODE_ENV=production
VITE_API_URL=https://your-api-domain.com
```

### 4. Custom Domain (Optional)
- Add your custom domain in the "Custom domains" section
- Update DNS to point to your Cloudflare Pages deployment

## Backend Deployment Options

### Option 1: Traditional Hosting (Heroku, Railway, DigitalOcean)

1. **Set environment variables**:
   ```
   SECRET_KEY=your-secret-key
   DATABASE_URL=postgresql://user:pass@host:port/db
   FLASK_ENV=production
   ```

2. **Deploy with Gunicorn**:
   ```bash
   gunicorn --bind 0.0.0.0:$PORT "app:create_app()"
   ```

3. **Database setup**:
   ```bash
   flask db upgrade
   ```

### Option 2: Serverless (Vercel Functions, AWS Lambda)

1. Create serverless function wrapper
2. Configure database connection pooling
3. Set up CORS for your frontend domain

### Option 3: Cloudflare Workers (Future)

The backend can be migrated to Cloudflare Workers for a fully serverless stack using:
- Cloudflare Workers for API
- Cloudflare D1 for database
- Cloudflare KV for sessions/cache

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
1. Start backend: `python run.py`
2. Start frontend: `npm run dev`
3. Access at: http://localhost:3000

### Staging Deployment
1. Push to `staging` branch
2. Automatic deployment to staging environment
3. Run integration tests

### Production Deployment
1. Create PR to `main` branch
2. Review and approve changes
3. Merge triggers production deployment
4. Monitor deployment and health checks