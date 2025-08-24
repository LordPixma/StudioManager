# StudioManager - SaaS

A comprehensive multi-tenant SaaS web application for managing fitness, music, dance, or any multi-room studios. Built with React frontend and Flask API backend, optimized for Cloudflare deployment.

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
- **Flask** API-only backend
- **SQLAlchemy** ORM with multi-tenant database design
- **Flask-Migrate** for database migrations
- **PostgreSQL** for production (SQLite for development)
- **Flask-CORS** for cross-origin requests

### Deployment
- **Cloudflare Pages** for frontend hosting
- **Cloudflare Workers** for backend API (planned)
- **Cloudflare D1** for database (planned)

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

#### Cloudflare Pages (Frontend)
1. Connect your GitHub repository to Cloudflare Pages
2. Set build command: `npm run build`
3. Set publish directory: `dist`
4. Deploy automatically on git push

#### Backend API
- **Option 1**: Traditional hosting (Heroku, DigitalOcean, AWS)
- **Option 2**: Cloudflare Workers (coming soon)

## Development

### Available Scripts

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
npm run lint         # Lint code
npm run lint:fix     # Fix linting issues

# Backend
python run.py        # Start Flask development server
flask db migrate     # Create database migration
flask db upgrade     # Apply database migrations
pytest              # Run tests
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
- [x] API-only Flask backend
- [x] Basic authentication and user management
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