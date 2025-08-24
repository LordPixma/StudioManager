from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

from .config import Config
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
    
    # Configure CORS for SaaS deployment
    CORS(app, 
         resources={r"/api/*": {"origins": ["http://localhost:3000", "https://*.pages.dev"]}}, 
         supports_credentials=True,
         allow_headers=["Content-Type", "Authorization", "X-Requested-With"],
         methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"])

    # Register API blueprints only
    from .auth.routes import auth_bp
    from .customers.routes import customers_bp
    from .tenants.routes import tenants_bp  # New tenant management
    app.register_blueprint(auth_bp, url_prefix='/api')
    app.register_blueprint(customers_bp, url_prefix='/api/customers')
    app.register_blueprint(tenants_bp, url_prefix='/api/tenants')

    # Health check endpoint
    @app.route('/api/health')
    def health_check():
        return make_response_payload(True, data={"status": "healthy"})

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

    # Handle CORS preflight requests
    @app.before_request
    def handle_preflight():
        if request.method == "OPTIONS":
            response = jsonify()
            response.headers.add("Access-Control-Allow-Origin", "*")
            response.headers.add('Access-Control-Allow-Headers', "*")
            response.headers.add('Access-Control-Allow-Methods', "*")
            return response

    return app