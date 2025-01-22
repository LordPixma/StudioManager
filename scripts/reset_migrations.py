# scripts/reset_migrations.py
from app import create_app, db
import sqlalchemy as sa

def reset_migrations():
    app = create_app('ProductionConfig')
    with app.app_context():
        try:
            # Try to drop the alembic_version table if it exists
            db.engine.execute('DROP TABLE IF EXISTS alembic_version')
            print("Successfully reset migrations")
        except Exception as e:
            print(f"Error resetting migrations: {e}")
            # Continue anyway

if __name__ == "__main__":
    reset_migrations()