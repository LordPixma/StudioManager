# /login, /logout, /register routes
"""
Routes for user registration, login, logout, session info, and field validations.
"""

from flask import Blueprint, request, session
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta

from .. import db
from ..models import User
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
        "name": user.name,
        "role": user.role,
        "permissions": user.permissions,
        "studio_id": user.studio_id
    }

@auth_bp.route('/register', methods=['POST'])
def register():
    """
    Public registration endpoint.
    - Only creates Receptionist users by default.
    """
    data = request.get_json() or {}
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')

    # Basic validation
    errors = {}
    if not name:    errors.setdefault('name', []).append('Name is required')
    if not email:   errors.setdefault('email', []).append('Email is required')
    if not password:errors.setdefault('password', []).append('Password is required')
    if User.query.filter_by(email=email).first():
        errors.setdefault('email', []).append('Email already exists')

    if errors:
        return make_response_payload(False, errors=errors), 400

    # Create user
    pw_hash = generate_password_hash(password)
    user = User(
        name=name,
        email=email,
        password_hash=pw_hash,
        role='Receptionist',
        permissions=['create_booking','edit_customer'],  # default perms
        studio_id=None
    )
    db.session.add(user)
    db.session.commit()

    # Establish session
    session.clear()
    session['user_id'] = user.id
    session.permanent = True

    payload = {
        "user": _format_user(user),
        "session_timeout": _get_session_timeout_iso()
    }
    return make_response_payload(True, data=payload, message="Registration successful"), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    """
    User login endpoint.
    Accepts JSON: { email, password, remember_me }
    """
    data = request.get_json() or {}
    email = data.get('email')
    password = data.get('password')
    remember_me = bool(data.get('remember_me', False))

    user = User.query.filter_by(email=email).first()
    if not user or not check_password_hash(user.password_hash, password):
        # Generic error for security
        return make_response_payload(False, message="Invalid email or password"), 401

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
    elif User.query.filter_by(email=email).first():
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
