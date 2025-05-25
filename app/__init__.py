# Flask app factory and Blueprint registration
"""
Application factory and extension initialization.
"""

from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from .config import Config
from .utils import register_error_handlers
from .auth import auth_bp

# Initialize extensions
db = SQLAlchemy()

def create_app():
    """
    Create and configure the Flask application.
    """
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(Config)

    # Initialize database
    db.init_app(app)

    # Enable CORS for our React frontend on localhost:3000
    CORS(app,
         resources={r"/api/*": {"origins": "http://localhost:3000"}},
         supports_credentials=True)

    # Register blueprints
    app.register_blueprint(auth_bp, url_prefix='/api')

    # Register global error handlers (400,401,403,404,500)
    register_error_handlers(app)

    return app
