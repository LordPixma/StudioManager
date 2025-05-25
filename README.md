# StudioManager

A comprehensive SaaS web application for managing fitness, music, dance, or any multi-room studios.

## Features

- **Customer Management**: Create, view, edit, and delete customer profiles
- **Room Booking**: Real-time booking with conflict detection
- **Staff & Session Scheduling**: Assign staff to sessions and manage schedules
- **Reporting & Analytics**: Dashboards with KPIs and exportable reports
- **Multi-Studio Support**: Manage multiple studio locations

## Tech Stack

- **Backend**: Flask (Python), SQLAlchemy, PostgreSQL
- **Frontend**: HTML5, CSS3, JavaScript, Jinja2
- **Authentication**: Flask-Login, bcrypt
- **Testing**: PyTest
- **Deployment**: Docker, Gunicorn, NGINX

## Setup

1. Clone the repository
2. Create virtual environment: python -m venv venv
3. Activate virtual environment: env\Scripts\activate (Windows) or source venv/bin/activate (Unix)
4. Install dependencies: pip install -r requirements.txt
5. Set up environment variables in .env
6. Initialize database: lask db upgrade
7. Run application: python run.py

## Development

- Run tests: pytest
- Create migration: lask db migrate -m "description"
- Apply migrations: lask db upgrade

## Docker

`ash
docker-compose up --build
`

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request
