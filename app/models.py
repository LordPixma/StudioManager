# SQLAlchemy models (users, studios, customers, rooms, bookings, staff, sessions)
"""
SQLAlchemy models for users and studios with multi-tenancy support.
"""
from datetime import datetime
from . import db

class Tenant(db.Model):
    """
    Tenant model for SaaS multi-tenancy.
    Each tenant represents a separate studio/organization.
    """
    __tablename__ = 'tenants'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    subdomain = db.Column(db.String(50), unique=True, nullable=False)
    plan = db.Column(db.String(20), default='free', nullable=False)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    settings = db.Column(db.JSON, default=dict)

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "subdomain": self.subdomain,
            "plan": self.plan,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() + "Z",
            "settings": self.settings or {}
        }

class Studio(db.Model):
    """
    Studio model representing a physical or virtual location within a tenant.
    """
    __tablename__ = 'studios'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    address = db.Column(db.Text)
    phone = db.Column(db.String(20))
    email = db.Column(db.String(120))
    settings = db.Column(db.JSON, default=dict)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "address": self.address,
            "phone": self.phone,
            "email": self.email,
            "settings": self.settings or {}
        }

class Customer(db.Model):
    __tablename__ = 'customers'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    phone = db.Column(db.String(20))
    notes = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow,
                           onupdate=datetime.utcnow, nullable=False)

    # Unique constraint for email per tenant
    __table_args__ = (db.UniqueConstraint('tenant_id', 'email', name='_tenant_customer_email_uc'),)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
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
        tenant_id (int): FK to Tenant.id (nullable only for global Admins).
    """
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), nullable=False, default='Receptionist')
    permissions = db.Column(db.JSON, nullable=False, default=list)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    # Unique constraint for email per tenant (global admins have no tenant_id)
    __table_args__ = (db.UniqueConstraint('tenant_id', 'email', name='_tenant_user_email_uc'),)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "permissions": self.permissions or [],
            "studio_id": self.studio_id,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() + "Z"
        }

# Additional models for full SaaS functionality

class Room(db.Model):
    """Room model for bookable spaces."""
    __tablename__ = 'rooms'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    studio_id = db.Column(db.Integer, db.ForeignKey('studios.id'), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    capacity = db.Column(db.Integer, nullable=False)
    hourly_rate = db.Column(db.Numeric(10, 2))
    equipment = db.Column(db.JSON, default=list)
    is_active = db.Column(db.Boolean, default=True, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "studio_id": self.studio_id,
            "name": self.name,
            "capacity": self.capacity,
            "hourly_rate": float(self.hourly_rate) if self.hourly_rate else None,
            "equipment": self.equipment or [],
            "is_active": self.is_active
        }

class Booking(db.Model):
    """Booking model for room reservations."""
    __tablename__ = 'bookings'

    id = db.Column(db.Integer, primary_key=True)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenants.id'), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey('rooms.id'), nullable=False)
    customer_id = db.Column(db.Integer, db.ForeignKey('customers.id'), nullable=False)
    start_time = db.Column(db.DateTime, nullable=False)
    end_time = db.Column(db.DateTime, nullable=False)
    status = db.Column(db.String(20), default='confirmed', nullable=False)
    notes = db.Column(db.Text)
    total_amount = db.Column(db.Numeric(10, 2))
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    def to_dict(self):
        return {
            "id": self.id,
            "tenant_id": self.tenant_id,
            "room_id": self.room_id,
            "customer_id": self.customer_id,
            "start_time": self.start_time.isoformat() + "Z",
            "end_time": self.end_time.isoformat() + "Z",
            "status": self.status,
            "notes": self.notes,
            "total_amount": float(self.total_amount) if self.total_amount else None,
            "created_at": self.created_at.isoformat() + "Z"
        }
