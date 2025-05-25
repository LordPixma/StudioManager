# Create StudioManager Application Directory Structure
# PowerShell Script to set up the complete project structure

param(
    [string]$ProjectPath = ".\studio_manager"
)

Write-Host "Creating StudioManager application structure at: $ProjectPath" -ForegroundColor Green

# Create main project directory
New-Item -ItemType Directory -Path $ProjectPath -Force | Out-Null

# Create main app package structure
$directories = @(
    "app",
    "app\auth",
    "app\customers", 
    "app\rooms",
    "app\staff",
    "app\reports",
    "app\templates",
    "app\templates\auth",
    "app\templates\customers",
    "app\templates\rooms", 
    "app\templates\staff",
    "app\templates\reports",
    "app\static",
    "app\static\css",
    "app\static\js",
    "app\static\images",
    "migrations",
    "migrations\versions",
    "tests",
    "scripts"
)

# Create all directories
foreach ($dir in $directories) {
    $fullPath = Join-Path $ProjectPath $dir
    New-Item -ItemType Directory -Path $fullPath -Force | Out-Null
    Write-Host "Created directory: $dir" -ForegroundColor Cyan
}

# Create main app files
$appFiles = @{
    "app\__init__.py" = "# Flask app factory and Blueprint registration"
    "app\config.py" = "# App-wide configuration (dev, prod, test)"
    "app\models.py" = "# SQLAlchemy models (users, studios, customers, rooms, bookings, staff, sessions)"
    "app\forms.py" = "# WTForms definitions for all CRUD forms"
    "app\utils.py" = "# Helper functions (e.g. date handling, email)"
}

# Create Blueprint __init__.py files
$blueprintInits = @(
    "app\auth\__init__.py",
    "app\customers\__init__.py", 
    "app\rooms\__init__.py",
    "app\staff\__init__.py",
    "app\reports\__init__.py"
)

# Create Blueprint route files
$blueprintRoutes = @{
    "app\auth\routes.py" = "# /login, /logout, /register routes"
    "app\customers\routes.py" = "# /customers, /customers/<id> routes"
    "app\rooms\routes.py" = "# /rooms, /bookings, conflict logic routes"
    "app\staff\routes.py" = "# /staff, /sessions routes"
    "app\reports\routes.py" = "# /reports/bookings, /reports/revenue, CSV/PDF exports routes"
}

# Create template files
$templateFiles = @{
    "app\templates\base.html" = "<!-- Site-wide layout with blocks -->"
    "app\templates\auth\login.html" = "<!-- Login form template -->"
    "app\templates\auth\register.html" = "<!-- Registration form template -->"
    "app\templates\customers\list.html" = "<!-- Customer list template -->"
    "app\templates\customers\detail.html" = "<!-- Customer detail template -->"
    "app\templates\customers\form.html" = "<!-- Customer form template -->"
    "app\templates\rooms\catalog.html" = "<!-- Room catalog template -->"
    "app\templates\rooms\calendar.html" = "<!-- Booking calendar template -->"
    "app\templates\staff\directory.html" = "<!-- Staff directory template -->"
    "app\templates\staff\scheduler.html" = "<!-- Session scheduler template -->"
    "app\templates\reports\dashboard.html" = "<!-- Reports dashboard template -->"
    "app\templates\reports\export_modal.html" = "<!-- Export modal template -->"
}

# Create static files
$staticFiles = @{
    "app\static\css\main.css" = "/* Main stylesheet */"
    "app\static\css\auth.css" = "/* Authentication styles */"
    "app\static\css\dashboard.css" = "/* Dashboard styles */"
    "app\static\js\main.js" = "// Main JavaScript file"
    "app\static\js\booking.js" = "// Booking functionality"
    "app\static\js\validation.js" = "// Form validation"
}

# Create test files
$testFiles = @{
    "tests\conftest.py" = "# PyTest configuration and fixtures"
    "tests\test_auth.py" = "# Authentication tests"
    "tests\test_customers.py" = "# Customer management tests"
    "tests\test_rooms.py" = "# Room and booking tests"
    "tests\test_staff.py" = "# Staff and session tests"
    "tests\test_reports.py" = "# Reporting tests"
}

# Create script files
$scriptFiles = @{
    "scripts\seed_db.py" = "# Database seeding script"
    "scripts\create_admin.py" = "# Create admin user script"
}

# Create root level files
$rootFiles = @{
    "run.py" = "# Simple CLI entry-point for local development"
    "requirements.txt" = @"
# StudioManager Python Dependencies
Flask==2.3.3
Flask-Login==0.6.3
Flask-WTF==1.2.1
WTForms==3.1.0
SQLAlchemy==2.0.23
Alembic==1.12.1
psycopg2-binary==2.9.9
bcrypt==4.1.2
pandas==2.1.4
celery==5.3.4
redis==5.0.1
python-dotenv==1.0.0
gunicorn==21.2.0
pytest==7.4.3
pytest-flask==1.3.0
"@
    "Dockerfile" = @"
# StudioManager Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "run:app"]
"@
    "docker-compose.yml" = @"
# StudioManager Docker Compose
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - FLASK_ENV=development
      - DATABASE_URL=postgresql://studio_user:studio_pass@db:5432/studio_manager
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    volumes:
      - .:/app

  db:
    image: postgres:15
    environment:
      - POSTGRES_DB=studio_manager
      - POSTGRES_USER=studio_user
      - POSTGRES_PASSWORD=studio_pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  postgres_data:
"@
    ".env" = @"
# StudioManager Environment Variables
FLASK_APP=run.py
FLASK_ENV=development
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgresql://studio_user:studio_pass@localhost:5432/studio_manager
REDIS_URL=redis://localhost:6379
MAIL_SERVER=localhost
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=
MAIL_PASSWORD=
"@
    ".gitignore" = @"
# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# C extensions
*.so

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# PyInstaller
*.manifest
*.spec

# Installer logs
pip-log.txt
pip-delete-this-directory.txt

# Unit test / coverage reports
htmlcov/
.tox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
.hypothesis/
.pytest_cache/

# Translations
*.mo
*.pot

# Django stuff:
*.log
local_settings.py
db.sqlite3

# Flask stuff:
instance/
.webassets-cache

# Scrapy stuff:
.scrapy

# Sphinx documentation
docs/_build/

# PyBuilder
target/

# Jupyter Notebook
.ipynb_checkpoints

# pyenv
.python-version

# celery beat schedule file
celerybeat-schedule

# SageMath parsed files
*.sage.py

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# Spyder project settings
.spyderproject
.spyproject

# Rope project settings
.ropeproject

# mkdocs documentation
/site

# mypy
.mypy_cache/
.dmypy.json
dmypy.json

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~

# OS generated files
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
"@
    "README.md" = @"
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
2. Create virtual environment: `python -m venv venv`
3. Activate virtual environment: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Unix)
4. Install dependencies: `pip install -r requirements.txt`
5. Set up environment variables in `.env`
6. Initialize database: `flask db upgrade`
7. Run application: `python run.py`

## Development

- Run tests: `pytest`
- Create migration: `flask db migrate -m "description"`
- Apply migrations: `flask db upgrade`

## Docker

```bash
docker-compose up --build
```

## Contributing

1. Fork the repository
2. Create feature branch
3. Make changes
4. Run tests
5. Submit pull request
"@
}

# Function to create files with content
function Create-FileWithContent {
    param(
        [string]$FilePath,
        [string]$Content
    )
    
    $fullPath = Join-Path $ProjectPath $FilePath
    $Content | Out-File -FilePath $fullPath -Encoding UTF8
    Write-Host "Created file: $FilePath" -ForegroundColor Yellow
}

# Create all files
Write-Host "`nCreating application files..." -ForegroundColor Green

# Create main app files
foreach ($file in $appFiles.GetEnumerator()) {
    Create-FileWithContent -FilePath $file.Key -Content $file.Value
}

# Create Blueprint __init__.py files
foreach ($initFile in $blueprintInits) {
    Create-FileWithContent -FilePath $initFile -Content "# Blueprint package"
}

# Create Blueprint route files
foreach ($route in $blueprintRoutes.GetEnumerator()) {
    Create-FileWithContent -FilePath $route.Key -Content $route.Value
}

# Create template files
foreach ($template in $templateFiles.GetEnumerator()) {
    Create-FileWithContent -FilePath $template.Key -Content $template.Value
}

# Create static files
foreach ($static in $staticFiles.GetEnumerator()) {
    Create-FileWithContent -FilePath $static.Key -Content $static.Value
}

# Create test files
foreach ($test in $testFiles.GetEnumerator()) {
    Create-FileWithContent -FilePath $test.Key -Content $test.Value
}

# Create script files
foreach ($script in $scriptFiles.GetEnumerator()) {
    Create-FileWithContent -FilePath $script.Key -Content $script.Value
}

# Create root level files
foreach ($root in $rootFiles.GetEnumerator()) {
    Create-FileWithContent -FilePath $root.Key -Content $root.Value
}

Write-Host "`nStudioManager application structure created successfully!" -ForegroundColor Green
Write-Host "Project location: $(Resolve-Path $ProjectPath)" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. cd $ProjectPath" -ForegroundColor Gray
Write-Host "2. python -m venv venv" -ForegroundColor Gray
Write-Host "3. venv\Scripts\activate" -ForegroundColor Gray
Write-Host "4. pip install -r requirements.txt" -ForegroundColor Gray
Write-Host "5. Copy .env and update with your settings" -ForegroundColor Gray
Write-Host "6. python run.py" -ForegroundColor Gray