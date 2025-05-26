# SQLAlchemy models (users, studios, customers, rooms, bookings, staff, sessions)
"""
SQLAlchemy models for users and studios.
"""
from datetime import datetime
from . import db

class Studio(db.Model):
    """
    Studio model representing a physical or virtual location.
    """
    __tablename__ = 'studios'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

class Customer(db.Model):
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False, unique=True)
    phone = db.Column(db.String(20))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "studio_id": self.studio_id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "notes": self.notes or "",
            "created_at": self.created_at.isoformat() + "Z",
            "updated_at": self.updated_at.isoformat() + "Z"
        }

class User(db.Model):
    """
    User model representing application users.
    Attributes:
        id (int): Primary key.
        name (str): Full name.
        email (str): Unique login email.
        password_hash (str): Hashed password.
        role (str): One of ['Admin','Studio Manager','Staff/Instructor','Receptionist'].
        permissions (JSON): List of capability strings.
        studio_id (int): FK to Studio.id (nullable for Admins).
    """
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='Receptionist')
    permissions = db.Column(db.JSON, nullable=False, default=list)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=True)
