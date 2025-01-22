# scripts/create_admin.py
import os
import sys
from pathlib import Path

# Add the project root directory to Python path
project_root = Path(__file__).parent.parent
sys.path.append(str(project_root))

from werkzeug.security import generate_password_hash
from app import create_app, db
from app.models.manager import StudioManager

def create_admin():
    """Create an admin user using environment variables."""
    app = create_app('ProductionConfig')
    
    with app.app_context():
        email = os.getenv('ADMIN_EMAIL')
        password = os.getenv('ADMIN_PASSWORD')
        
        if not email or not password:
            print("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables must be set")
            sys.exit(1)
            
        # Check if admin already exists
        existing_admin = StudioManager.query.filter_by(email=email).first()
        if existing_admin:
            print(f"Admin user with email {email} already exists")
            return
            
        # Create admin user (studio_id=None indicates admin status)
        admin = StudioManager(
            name='Admin',  # Default name, can be changed later
            email=email,
            password=generate_password_hash(password),
            studio_id=None  # None indicates this is an admin user
        )
        
        try:
            db.session.add(admin)
            db.session.commit()
            print(f"Admin user created successfully with email: {email}")
        except Exception as e:
            db.session.rollback()
            print(f"Error creating admin user: {str(e)}")
            sys.exit(1)

if __name__ == "__main__":
    create_admin()