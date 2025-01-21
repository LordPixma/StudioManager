# app/models/manager.py
# Model for the Studio Manager entity.

from app import db

class StudioManager(db.Model):
    __tablename__ = 'studio_managers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=True)

    # Relationship with Studio
    studio = db.relationship('Studio', back_populates='managers')

    def __repr__(self):
        return f"<StudioManager {self.name}>"
