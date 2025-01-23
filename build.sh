Here's the adjusted build script with admin user existence check:

```bash
#!/usr/bin/env bash
set -o errexit

echo "🚀 Starting build process..."

python -m venv .venv
source .venv/bin/activate

python -m pip install --upgrade pip
python -m pip install --no-cache-dir -r requirements.txt

required_vars=("DATABASE_URL" "SECRET_KEY" "FLASK_APP" "FLASK_ENV")
for var in "${required_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: Required environment variable $var is not set"
        exit 1
    fi
done

mkdir -p instance logs app/static/uploads
chmod -R 755 app/static instance logs

# Clean and reinitialize database with admin check
python << EOF
from app import create_app, db
from sqlalchemy import text
from app.models.manager import StudioManager

app = create_app('ProductionConfig')
with app.app_context():
    db.drop_all()
    with db.engine.connect() as conn:
        conn.execute(text('DROP TABLE IF EXISTS alembic_version'))
        conn.commit()
    db.create_all()
    
    # Check if admin exists
    admin = StudioManager.query.filter_by(studio_id=None).first()
    if not admin:
        print("No admin user found - new admin will be created")
    else:
        print("Admin user already exists - skipping creation")
EOF

export FLASK_APP=run.py
rm -rf migrations
flask db init
flask db migrate -m "Initial migration"
flask db upgrade

if [ -n "$ADMIN_EMAIL" ] && [ -n "$ADMIN_PASSWORD" ]; then
    echo "👤 Checking/creating admin user..."
    python << EOF
from app import create_app, db
from app.models.manager import StudioManager
from werkzeug.security import generate_password_hash

app = create_app('ProductionConfig')
with app.app_context():
    existing_admin = StudioManager.query.filter_by(studio_id=None).first()
    if not existing_admin:
        admin = StudioManager(
            name='Admin',
            email='$ADMIN_EMAIL',
            password=generate_password_hash('$ADMIN_PASSWORD'),
            studio_id=None
        )
        db.session.add(admin)
        db.session.commit()
        print("Admin user created successfully")
    else:
        print("Admin user already exists - skipping creation")
EOF
fi

find . -type d -name "__pycache__" -exec rm -r {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true

echo "✅ Build completed successfully!"
```