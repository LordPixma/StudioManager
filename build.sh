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

# Create directories
mkdir -p instance logs app/static/uploads
chmod -R 755 app/static instance logs

# Run migrations
export PYTHONPATH=$PYTHONPATH:$(pwd)
flask db upgrade

# Create admin if needed
if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    PYTHONPATH=$(pwd) python scripts/create_admin.py
fi

# Cleanup
find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

echo "🎉 Build script completed successfully!"