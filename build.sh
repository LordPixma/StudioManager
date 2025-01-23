#!/usr/bin/env bash
# build.sh - Deployment build script for StudioManager on Render

set -o errexit

echo "🚀 Starting build process..."

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate

# Install dependencies
python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r requirements.txt

# Verify environment variables
required_vars=("DATABASE_URL" "SECRET_KEY" "FLASK_APP" "FLASK_ENV")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Create directories and set permissions
mkdir -p instance logs app/static/uploads
chmod -R 755 app/static instance logs

# Clean and reinitialize database
python << EOF
from app import create_app, db
from flask_migrate import init, migrate, upgrade
from sqlalchemy import text

app = create_app('ProductionConfig')
with app.app_context():
    # Drop existing tables
    db.drop_all()
    db.engine.execute(text('DROP TABLE IF EXISTS alembic_version'))
    # Create new tables
    db.create_all()
EOF

# Initialize fresh migrations
export FLASK_APP=run.py
rm -rf migrations
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# Create admin user if credentials provided
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "👤 Creating admin user..."
    python scripts/create_admin.py
fi

# Cleanup
find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

echo "✅ Build completed successfully!"