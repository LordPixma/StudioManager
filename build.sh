#!/usr/bin/env bash
# build.sh - Deployment build script for StudioManager on Render

# Exit on error
set -o errexit

echo "🚀 Starting build process..."

# Create and activate virtual environment
echo "🔧 Creating virtual environment..."
python -m venv .venv
source .venv/bin/activate

# Upgrade pip and install dependencies
echo "📦 Installing dependencies..."
python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r requirements.txt

# Verify critical environment variables
echo "✔️ Verifying environment variables..."
required_vars=(
    "DATABASE_URL"
    "SECRET_KEY"
    "FLASK_APP"
    "FLASK_ENV"
)

for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

# Create necessary directories
echo "📁 Creating application directories..."
mkdir -p instance
mkdir -p logs
mkdir -p app/static/uploads

# Set proper permissions
echo "🔒 Setting file permissions..."
chmod -R 755 app/static
chmod -R 755 instance
chmod -R 755 logs

# Setup database migrations
echo "🔄 Setting up database migrations..."

# Reset database using Python script
echo "Resetting database schema..."
PYTHONPATH=/opt/render/project/src python << EOF
from app import create_app, db
from sqlalchemy import text

app = create_app('ProductionConfig')
with app.app_context():
    try:
        # Drop the alembic_version table first
        with db.engine.connect() as conn:
            conn.execute(text('DROP TABLE IF EXISTS alembic_version'))
            conn.commit()
        print("Successfully dropped alembic_version table")

        # Drop all other tables
        db.drop_all()
        print("Successfully dropped all tables")
        
        # Create all tables fresh
        db.create_all()
        print("Successfully created all tables")
    except Exception as e:
        print(f"Warning during database reset: {str(e)}")
EOF

# Initialize fresh migrations
echo "Initializing fresh migrations..."
export FLASK_APP=run.py
export FLASK_CONFIG=ProductionConfig
export PYTHONPATH=/opt/render/project/src

flask db init
flask db migrate -m "Initial migration"
flask db upgrade

# Create initial admin user if environment variables are set
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "👤 Creating admin user..."
    PYTHONPATH=/opt/render/project/src python scripts/create_admin.py
else
    echo "⚠️ Skipping admin user creation - ADMIN_EMAIL and/or ADMIN_PASSWORD not set"
fi

# Cleanup
echo "🧹 Cleaning up..."
find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

echo "🎉 Build script completed successfully!"