"""
Application factory and extension initialization.
"""

from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from .config import Config
from .utils import register_error_handlers

# 1) Define extensions here
db = SQLAlchemy()

def create_app():
    """
    Create and configure the Flask application.
    """
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(Config)

    # 2) Initialize extensions with the app
    db.init_app(app)
    CORS(app,
         resources={r"/api/*": {"origins": "http://localhost:3000"}},
         supports_credentials=True)

    # 3) Now import and register blueprints **after** extensions exist
    from .auth.routes import auth_bp
    app.register_blueprint(auth_bp, url_prefix='/api')

    # 4) Register error handlers
    register_error_handlers(app)

    return app
