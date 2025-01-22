import os
from werkzeug.security import generate_password_hash
from app import create_app, db
from app.models.manager import StudioManager

def create_admin():
    # Initialize the Flask app and database context
    app = create_app("DevelopmentConfig")  # Use the proper class name here
    with app.app_context():
        # Prompt user for admin credentials
        print("Create Admin User")
        username = input("Enter username: ").strip()
        email = input("Enter email: ").strip()
        password = input("Enter password: ").strip()

        # Check if admin user already exists
        existing_admin = StudioManager.query.filter_by(email=email).first()
        if existing_admin:
            print("Error: An admin user with this email already exists.")
            return

        # Create admin user
        hashed_password = generate_password_hash(password)
        admin_user = StudioManager(
            name=username,
            email=email,
            password=hashed_password,
            studio_id=None  # Admins may not be tied to a specific studio
        )

        db.session.add(admin_user)
        db.session.commit()
        print("Admin user created successfully.")

if __name__ == "__main__":
    create_admin()
