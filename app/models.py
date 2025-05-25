# SQLAlchemy models (users, studios, customers, rooms, bookings, staff, sessions)
"""
SQLAlchemy models for users and studios.
"""

from . import db

class Studio(db.Model):
    """
    Studio model representing a physical or virtual location.
    """
    __tablename__ = 'studios'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)

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
