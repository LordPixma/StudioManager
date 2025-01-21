# app/models/room.py
# Model for the Room entity.

from app import db

class Room(db.Model):
    __tablename__ = 'rooms'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=False)
    availability = db.Column(db.String(255), nullable=True)  # JSON string for availability times

    # Relationship with Studio
    studio = db.relationship('Studio', back_populates='rooms')
    sessions = db.relationship('Session', back_populates='room')

    def __repr__(self):
        return f"<Room {self.name} in Studio ID {self.studio_id}>"
