# scripts/reset_migrations.py
from app import create_app, db
from sqlalchemy import text

def reset_migrations():
    app = create_app('ProductionConfig')
    with app.app_context():
        try:
            # Use the new SQLAlchemy API syntax
            with db.engine.connect() as conn:
                conn.execute(text('DROP TABLE IF EXISTS alembic_version'))
                conn.commit()
            print("Successfully reset migrations")
        except Exception as e:
            print(f"Error resetting migrations: {e}")
            # Continue anyway

if __name__ == "__main__":
    reset_migrations()