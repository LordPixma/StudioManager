from app import create_app, db
from app.models.studio import Studio

def create_studio():
    # Initialize the Flask app and database context
    app = create_app("DevelopmentConfig")
    
    with app.app_context():
        print("\nCreate New Studio")
        
        # Get studio details
        while True:
            name = input("Enter studio name: ").strip()
            # Check if studio name already exists
            existing_studio = Studio.query.filter_by(name=name).first()
            if existing_studio:
                print("Error: A studio with this name already exists. Please choose a different name.")
                continue
            if not name:
                print("Error: Studio name cannot be empty.")
                continue
            break
            
        while True:
            address = input("Enter studio address: ").strip()
            if not address:
                print("Error: Studio address cannot be empty.")
                continue
            break
            
        phone_number = input("Enter phone number (optional): ").strip()
        
        try:
            # Create studio
            new_studio = Studio(
                name=name,
                address=address,
                phone_number=phone_number if phone_number else None
            )
            
            db.session.add(new_studio)
            db.session.commit()
            
            print("\nStudio created successfully!")
            print(f"Studio ID: {new_studio.id}")
            print(f"Name: {new_studio.name}")
            print(f"Address: {new_studio.address}")
            if new_studio.phone_number:
                print(f"Phone: {new_studio.phone_number}")
                
            # Show hint about creating a manager
            print("\nHint: You can now create a studio manager for this studio using:")
            print("python create_studio_manager.py")
            
        except Exception as e:
            print(f"Error creating studio: {str(e)}")
            db.session.rollback()

def list_studios():
    """Helper function to list all existing studios"""
    studios = Studio.query.all()
    if not studios:
        print("\nNo studios exist yet.")
        return
    
    print("\nExisting Studios:")
    for studio in studios:
        print(f"ID: {studio.id}")
        print(f"Name: {studio.name}")
        print(f"Address: {studio.address}")
        print(f"Phone: {studio.phone_number or 'Not provided'}")
        print("-" * 40)

if __name__ == "__main__":
    app = create_app("DevelopmentConfig")
    with app.app_context():
        # First show existing studios
        list_studios()
        
        # Ask if user wants to create a new studio
        while True:
            create_new = input("\nDo you want to create a new studio? (y/n): ").strip().lower()
            if create_new in ['y', 'n']:
                break
            print("Please enter 'y' for yes or 'n' for no.")
        
        if create_new == 'y':
            create_studio()
        else:
            print("Operation cancelled.")