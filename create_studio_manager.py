from werkzeug.security import generate_password_hash
from app import create_app, db
from app.models.manager import StudioManager
from app.models.studio import Studio

def create_studio_manager():
    # Initialize the Flask app and database context
    app = create_app("DevelopmentConfig")
    
    with app.app_context():
        # First, check if there are any studios
        studios = Studio.query.all()
        if not studios:
            print("Error: No studios exist. Please create a studio first.")
            return

        # Print available studios
        print("\nAvailable Studios:")
        for studio in studios:
            print(f"ID: {studio.id}, Name: {studio.name}, Address: {studio.address}")

        # Prompt user for manager details
        print("\nCreate Studio Manager")
        name = input("Enter manager name: ").strip()
        email = input("Enter email: ").strip()
        password = input("Enter password: ").strip()
        
        while True:
            try:
                studio_id = int(input("Enter studio ID from the list above: ").strip())
                studio = Studio.query.get(studio_id)
                if studio:
                    break
                print("Invalid studio ID. Please try again.")
            except ValueError:
                print("Please enter a valid number.")

        # Check if manager with this email already exists
        existing_manager = StudioManager.query.filter_by(email=email).first()
        if existing_manager:
            print("Error: A manager with this email already exists.")
            return

        try:
            # Create manager
            hashed_password = generate_password_hash(password)
            manager = StudioManager(
                name=name,
                email=email,
                password=hashed_password,
                studio_id=studio_id
            )

            db.session.add(manager)
            db.session.commit()
            print(f"\nStudio manager created successfully!")
            print(f"Name: {manager.name}")
            print(f"Email: {manager.email}")
            print(f"Studio: {studio.name}")
            
        except Exception as e:
            print(f"Error creating studio manager: {str(e)}")
            db.session.rollback()

if __name__ == "__main__":
    create_studio_manager()