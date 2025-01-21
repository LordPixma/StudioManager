# app/utils/auth.py
# Utility functions for authentication and authorization.

from functools import wraps
from flask import request, jsonify
from app.models.manager import StudioManager
from app.models.admin import Admin  # Assuming there's an Admin model for admin users
import jwt
from datetime import datetime, timedelta

# Secret key for JWT signing (use environment variables in production)
SECRET_KEY = "your-secret-key"

def generate_token(user_id, role, expires_in=24):
    """
    Generate a JWT token.
    Args:
        user_id (int): The user's ID.
        role (str): The user's role ('admin' or 'manager').
        expires_in (int): Token expiration time in hours.
    Returns:
        str: Encoded JWT token.
    """
    payload = {
        "user_id": user_id,
        "role": role,
        "exp": datetime.utcnow() + timedelta(hours=expires_in)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def decode_token(token):
    """
    Decode a JWT token.
    Args:
        token (str): The JWT token.
    Returns:
        dict: Decoded payload if valid, None otherwise.
    """
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        return None  # Token expired
    except jwt.InvalidTokenError:
        return None  # Invalid token

def token_required(f):
    """
    Decorator to protect routes with token authentication.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.headers.get("Authorization")
        if not token:
            return jsonify({"error": "Token is missing"}), 401

        try:
            token_data = decode_token(token)
            if not token_data:
                return jsonify({"error": "Invalid or expired token"}), 401
        except Exception as e:
            return jsonify({"error": str(e)}), 401

        request.user_id = token_data["user_id"]
        request.role = token_data["role"]
        return f(*args, **kwargs)

    return decorated

def admin_required(f):
    """
    Decorator to allow only admin users to access a route.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not request.role or request.role != "admin":
            return jsonify({"error": "Admin access required"}), 403

        return f(*args, **kwargs)

    return decorated

def manager_required(f):
    """
    Decorator to allow only studio managers to access a route.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        if not request.role or request.role != "manager":
            return jsonify({"error": "Manager access required"}), 403

        return f(*args, **kwargs)

    return decorated

def authenticate_user(email, password, role):
    """
    Authenticate a user based on email, password, and role.
    Args:
        email (str): User's email.
        password (str): User's password.
        role (str): User's role ('admin' or 'manager').
    Returns:
        dict: User data if authenticated, None otherwise.
    """
    user = None

    if role == "admin":
        user = Admin.query.filter_by(email=email).first()
    elif role == "manager":
        user = StudioManager.query.filter_by(email=email).first()

    if user and user.password == password:  # Replace with hashed password check in production
        return {
            "user_id": user.id,
            "role": role
        }

    return None
