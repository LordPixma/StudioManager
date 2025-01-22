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

# Remove existing migrations and reinitialize
echo "Cleaning up migrations..."
rm -rf migrations
export PYTHONPATH=$PYTHONPATH:$(pwd)

# Initialize fresh migrations
echo "Initializing fresh migrations..."
flask db init

echo "Creating initial migration..."
flask db migrate -m "Initial migration"

echo "Applying migrations..."
flask db upgrade || {
    echo "Migration failed, attempting to stamp head and retry..."
    flask db stamp head
    flask db upgrade
}

# Create initial admin user if environment variables are set
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "👤 Creating admin user..."
    PYTHONPATH=$(pwd) python scripts/create_admin.py
else
    echo "⚠️ Skipping admin user creation - ADMIN_EMAIL and/or ADMIN_PASSWORD not set"
fi

# Cleanup
echo "🧹 Cleaning up..."
find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

echo "🎉 Build script completed successfully!"

# Final verification
echo "🔍 Performing final checks..."
python -c "
import sys
import flask
import sqlalchemy
print(f'Python version: {sys.version}')
print(f'Flask version: {flask.__version__}')
print(f'SQLAlchemy version: {sqlalchemy.__version__}')
"