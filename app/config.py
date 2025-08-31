# App-wide configuration (dev, prod, test)
"""
Configuration settings for Flask application.
"""

import os

class Config:
    # Secret key for session signing. Override in production via environment variable.
    SECRET_KEY = os.environ.get('SECRET_KEY', 'change-me')

    # SQLAlchemy settings (update DATABASE_URL in production)
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///studio_manager.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Session cookie settings (override via environment for prod)
    SESSION_COOKIE_SECURE = os.environ.get('SESSION_COOKIE_SECURE', 'true').lower() == 'true'  # HTTPS only
    SESSION_COOKIE_HTTPONLY = os.environ.get('SESSION_COOKIE_HTTPONLY', 'true').lower() == 'true'
    SESSION_COOKIE_SAMESITE = os.environ.get('SESSION_COOKIE_SAMESITE', 'Lax')
    PERMANENT_SESSION_LIFETIME = int(os.environ.get('PERMANENT_SESSION_LIFETIME', '3600'))
    
    WTF_CSRF_SECRET_KEY = SECRET_KEY
    WTF_CSRF_TIME_LIMIT = None