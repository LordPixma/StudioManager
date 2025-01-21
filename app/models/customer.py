# app/models/customer.py
# Model for the Customer entity.

from app import db

class Customer(db.Model):
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    phone_number = db.Column(db.String(15), nullable=True)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=False)
    sessions = db.relationship('Session', back_populates='customer')

    def __repr__(self):
        return f"<Customer {self.name}>"
