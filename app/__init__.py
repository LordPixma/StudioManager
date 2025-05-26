from flask import Flask, render_template, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

from .config import Config
from .utils import make_response_payload  # keep JSON payload helper

# Initialize extensions
db = SQLAlchemy()

def create_app():
     app = Flask(__name__, instance_relative_config=False)
     app.config.from_object(Config)

     app.context_processor
     def inject_csrf_token():
        # returns a callable so {{ csrf_token() }} in templates works
        return { 'csrf_token': lambda: '' }

     # Init extensions
     db.init_app(app)
     CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}}, supports_credentials=True)

     # Register blueprints
     from .auth.routes import auth_bp
     from .customers.routes import customers_bp
     from .ui.routes import ui_bp
     app.register_blueprint(auth_bp, url_prefix='/api')
     app.register_blueprint(customers_bp, url_prefix='/api/customers')
     app.register_blueprint(ui_bp)

     # Error handlers for API vs HTML
     @app.errorhandler(404)
     def handle_404(error):
          # JSON response for API endpoints
          if request.path.startswith('/api/'):
               return make_response_payload(False, message="Not found"), 404
          # HTML error page for UI
          return render_template('errors/404.html'), 404

     @app.errorhandler(500)
     def handle_500(error):
          if request.path.startswith('/api/'):
               return make_response_payload(False, message="Internal server error"), 500
          return render_template('errors/500.html'), 500

     return app