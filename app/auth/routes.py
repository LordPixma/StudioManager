# /login, /logout, /register routes
"""
Routes for user registration, login, logout, session info, and field validations.
Updated for multi-tenant SaaS architecture.
"""

from flask import Blueprint, request, session
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
import re

from .. import db
from ..models import User, Tenant, Studio
from ..utils import make_response_payload

auth_bp = Blueprint('auth', __name__)

def _get_session_timeout_iso():
    """
    Calculate UTC session timeout (now + 60 minutes) in ISO 8601 with 'Z'.
    """
    return (datetime.utcnow() + timedelta(minutes=60)).isoformat() + 'Z'

def _format_user(user):
    """
    Serialize a User model to JSON-friendly dict.
    """
    return {
        "id": user.id,
        "tenant_id": user.tenant_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "permissions": user.permissions,
        "studio_id": user.studio_id,
        "is_active": user.is_active
    }

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    SaaS registration endpoint.
    Creates new tenant with admin user, or adds user to existing tenant.
    """
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    tenant_name = data.get('tenant_name', '').strip()  # For new tenant creation
    tenant_id = data.get('tenant_id')  # For adding to existing tenant

    # Basic validation
    errors = {}
    if not name:
        errors.setdefault('name', []).append('Name is required')
    if not email:
        errors.setdefault('email', []).append('Email is required')
    elif not re.match(r'^[^@]+@[^@]+\.[^@]+$', email):
        errors.setdefault('email', []).append('Invalid email format')
    if not password:
        errors.setdefault('password', []).append('Password is required')
    elif len(password) < 8:
        errors.setdefault('password', []).append('Password must be at least 8 characters')

    # Check if user already exists
    existing_user = User.query.filter_by(email=email).first()
    if existing_user:
        errors.setdefault('email', []).append('Email already registered')

    # Backward-compat: if no tenant provided, derive a default tenant name
    if not tenant_name and not tenant_id:
        if name:
            tenant_name = f"{name}'s Studio"
        else:
            errors.setdefault('tenant_name', []).append('Studio/Company name is required for new registration')

    if errors:
        try:
            print('register_validation_errors', errors)
        except Exception:
            pass
        return make_response_payload(False, errors=errors), 400

    try:
        if tenant_name and not tenant_id:
            # Create new tenant (SaaS signup) inline to avoid cross-call coupling
            tenant = Tenant(name=tenant_name, subdomain=re.sub(r'[^a-zA-Z0-9-]', '-', tenant_name.lower())[:20] or 'studio', plan='free', is_active=True)
            db.session.add(tenant)
            db.session.flush()

            # Default studio for tenant
            studio = Studio(tenant_id=tenant.id, name=f"{tenant_name} - Main Studio")
            db.session.add(studio)
            db.session.flush()

            # Admin user for the tenant
            admin_user = User(
                tenant_id=tenant.id,
                studio_id=studio.id,
                name=name,
                email=email,
                password_hash=generate_password_hash(password),
                role='Studio Manager',
                permissions=[
                    'view_customers', 'create_customer', 'edit_customer', 'delete_customer',
                    'view_bookings', 'create_booking', 'edit_booking', 'cancel_booking',
                    'view_staff', 'create_staff', 'edit_staff',
                    'view_reports', 'manage_studio'
                ]
            )
            db.session.add(admin_user)
            db.session.commit()
            user_data = admin_user.to_dict()

        else:
            # Add user to existing tenant
            if not tenant_id:
                return make_response_payload(False, message="Tenant ID required"), 400
                
            tenant = Tenant.query.get(tenant_id)
            if not tenant or not tenant.is_active:
                return make_response_payload(False, message="Invalid tenant"), 400
            
            # Get default studio for tenant
            studio = Studio.query.filter_by(tenant_id=tenant_id).first()
            
            user = User(
                tenant_id=tenant_id,
                studio_id=studio.id if studio else None,
                name=name,
                email=email,
                password_hash=generate_password_hash(password),
                role='Receptionist',
                permissions=['create_booking', 'edit_customer']
            )
            
            db.session.add(user)
            db.session.commit()
            user_data = user.to_dict()

        # Establish session
        session.clear()
        session['user_id'] = user_data['id']
        session.permanent = True

        payload = {
            "user": user_data,
            "session_timeout": _get_session_timeout_iso()
        }
        # Return 201 to indicate creation (compat with tests)
        return make_response_payload(True, data=payload, message="Registration successful"), 201

    except Exception as e:
        db.session.rollback()
        return make_response_payload(False, message=f"Registration failed: {str(e)}"), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    Multi-tenant user login endpoint.
    Accepts JSON: { email, password, remember_me }
    """
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')
    remember_me = bool(data.get('remember_me', False))

    if not email or not password:
        return make_response_payload(False, message="Email and password are required"), 400

    # Find user by email (could be in any tenant)
    user = User.query.filter_by(email=email).first()
    
    if not user or not check_password_hash(user.password_hash, password):
        return make_response_payload(False, message="Invalid email or password"), 401
    
    # Check if user and tenant are active
    if not user.is_active:
        return make_response_payload(False, message="Account is deactivated"), 401
    
    if user.tenant_id:
        from ..models import Tenant
        tenant = Tenant.query.get(user.tenant_id)
        if not tenant or not tenant.is_active:
            return make_response_payload(False, message="Studio account is not active"), 401

    # Establish session
    session.clear()
    session['user_id'] = user.id
    session.permanent = remember_me

    payload = {
        "user": _format_user(user),
        "session_timeout": _get_session_timeout_iso()
    }
    return make_response_payload(True, data=payload, message="Login successful")

@auth_bp.route('/session', methods=['GET'])
def session_info():
    """
    Return current user info and refreshed session_timeout.
    """
    user_id = session.get('user_id')
    if not user_id:
        return make_response_payload(False, message="Unauthorized"), 401

    user = User.query.get(user_id)
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    payload = {
        "user": _format_user(user),
        "session_timeout": _get_session_timeout_iso()
    }
    return make_response_payload(True, data=payload)

@auth_bp.route('/logout', methods=['POST'])
def logout():
    """
    Clear session and log user out.
    """
    session.clear()
    return make_response_payload(True, message="Logged out")

@auth_bp.route('/validate/email', methods=['POST'])
def validate_email():
    """
    Real-time check for email uniqueness.
    Returns 400 with field-specific error if taken.
    """
    data = request.get_json() or {}
    email = data.get('email')
    errors = {}

    if not email:
        errors['email'] = ['Email is required']
    else:
        # If a user is logged in, check within their tenant; otherwise check globally
        from ..utils import get_current_user
        u = get_current_user()
        if u and u.tenant_id is not None:
            exists = User.query.filter_by(tenant_id=u.tenant_id, email=email).first()
        else:
            exists = User.query.filter_by(email=email).first()
        if exists:
            errors['email'] = ['Email already exists']

    if errors:
        return make_response_payload(False, errors=errors), 400

    return make_response_payload(True, message="Email is available")

@auth_bp.route('/validate/booking', methods=['POST'])
def validate_booking():
    """
    Stub for booking conflict validation.
    Always returns no conflicts for now; real logic in Sprint 3.
    """
    return make_response_payload(True, conflicts=[])
