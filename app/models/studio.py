# app/models/studio.py
# Model for the Studio entity.

from app import db

class Studio(db.Model):
    __tablename__ = 'studios'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    address = db.Column(db.String(255), nullable=False)
    phone_number = db.Column(db.String(15), nullable=True)
    created_at = db.Column(db.DateTime, default=db.func.now())

    # Relationship with StudioManager
    managers = db.relationship('StudioManager', back_populates='studio', cascade='all, delete-orphan')

    # Relationship with Room
    rooms = db.relationship('Room', back_populates='studio', cascade='all, delete-orphan')

    def __repr__(self):
        return f"<Studio {self.name}>"
