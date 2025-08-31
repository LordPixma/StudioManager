from flask import Flask
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
import os

from .config import Config
import sqlalchemy as sa
from .utils import make_response_payload

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app():
    app = Flask(__name__, instance_relative_config=False)
    app.config.from_object(Config)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)
    
    # Configure CORS for SaaS deployment (origins from env CORS_ORIGINS)
    cors_origins_env = os.environ.get("CORS_ORIGINS", "http://localhost:3000,https://*.pages.dev")
    cors_origins = [o.strip() for o in cors_origins_env.split(",") if o.strip()]
    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        supports_credentials=True,
        allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
        methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    )

    # Register API blueprints only
    from .auth.routes import auth_bp
    from .customers.routes import customers_bp
    from .tenants.routes import tenants_bp  # New tenant management
    from .ui.routes import ui_bp
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(tenants_bp, url_prefix='/api/tenants')
    app.register_blueprint(ui_bp)

    # Security headers
    @app.after_request
    def set_security_headers(response):
        csp = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            "connect-src 'self' " + " ".join(cors_origins) + "; "
            "frame-ancestors 'none';"
        )
        response.headers.setdefault('Content-Security-Policy', csp)
        response.headers.setdefault('X-Content-Type-Options', 'nosniff')
        response.headers.setdefault('X-Frame-Options', 'DENY')
        response.headers.setdefault('Referrer-Policy', 'no-referrer')
        response.headers.setdefault('Permissions-Policy', 'geolocation=(), microphone=(), camera=()')
        # HSTS only if secure cookies (i.e., HTTPS)
        if app.config.get('SESSION_COOKIE_SECURE'):
            response.headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload')
        return response

    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return make_response_payload(True, data={"status": "healthy"})

    # Readiness check: DB connectivity
    @app.route('/api/readiness')
    def readiness_check():
        try:
            # Simple no-op DB query
            db.session.execute(sa.text('SELECT 1'))
            return make_response_payload(True, data={"db": "ok"})
        except Exception as e:
            return make_response_payload(False, message=f"DB not ready: {str(e)}"), 503

    # API-only error handlers
    @app.errorhandler(404)
    def handle_404(error):
        return make_response_payload(False, message="API endpoint not found"), 404

    @app.errorhandler(500)
    def handle_500(error):
        return make_response_payload(False, message="Internal server error"), 500

    @app.errorhandler(400)
    def handle_400(error):
        return make_response_payload(False, message="Bad request"), 400

    return app