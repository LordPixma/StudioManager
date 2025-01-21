# app/models/session.py
# Model for Session entity.

from app import db
from datetime import datetime

class Session(db.Model):
    __tablename__ = 'sessions'

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    status = db.Column(db.String(50), nullable=False, default="ongoing")  # ongoing or completed

    # Relationships
    room = db.relationship('Room', back_populates='sessions')
    customer = db.relationship('Customer', back_populates='sessions')

    def __repr__(self):
        return f"<Session {self.id}: Room {self.room_id}, Customer {self.customer_id}, Status {self.status}>"
