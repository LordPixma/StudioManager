from app import db
from app.models.studio import Studio
from app.models.manager import StudioManager

def seed_data():
    studio1 = Studio(name="Main Studio", address="123 Studio Lane", phone_number="1234567890")
    studio2 = Studio(name="Downtown Studio", address="456 City Center", phone_number="0987654321")

    manager1 = StudioManager(name="John Doe", email="john@example.com", password="password123", studio_id=1)
    manager2 = StudioManager(name="Jane Smith", email="jane@example.com", password="password456", studio_id=2)

    db.session.add_all([studio1, studio2, manager1, manager2])
    db.session.commit()
    print("Database seeded successfully!")

if __name__ == "__main__":
    from app import create_app
    app = create_app('config.DevelopmentConfig')
    with app.app_context():
        seed_data()
