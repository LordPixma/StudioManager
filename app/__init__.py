# app/__init__.py
# Initialize the Flask application and register blueprints.

from flask import Flask, render_template, redirect, url_for, session as flask_session
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()

def create_app(config_class="DevelopmentConfig"):
    """
    Factory function to create and configure the Flask app.
    """
    app = Flask(__name__)
    
    # Import config directly
    from app.config import Config, DevelopmentConfig, ProductionConfig, TestingConfig
    
    # Select the config class based on the name
    config_mapping = {
        'Config': Config,
        'DevelopmentConfig': DevelopmentConfig,
        'ProductionConfig': ProductionConfig,
        'TestingConfig': TestingConfig
    }
    
    selected_config = config_mapping.get(config_class, DevelopmentConfig)
    app.config.from_object(selected_config)

    # Initialize extensions
    db.init_app(app)
    migrate.init_app(app, db)

    # Register blueprints
    from app.routes.admin_routes import admin_routes
    from app.routes.manager_routes import manager_routes
    app.register_blueprint(admin_routes, url_prefix='/admin')
    app.register_blueprint(manager_routes, url_prefix='/manager')

    # Import models
    with app.app_context():
        from app.models import studio, manager, room, customer, session

    @app.route('/')
    def index():
        if 'admin_id' in flask_session:
            return redirect(url_for('admin_routes.admin_dashboard'))
        elif 'manager_id' in flask_session:
            return redirect(url_for('manager_routes.manager_dashboard'))
        return render_template('index.html')
    
    @app.route('/logout')
    def logout():
        flask_session.clear()  # Clear all session data
        return redirect(url_for('index'))

    # Error handler for 404
    @app.errorhandler(404)
    def page_not_found(e):
        return render_template('404.html'), 404

    return app


# For running standalone (useful for development)
if __name__ == "__main__":
    app = create_app("config.DevelopmentConfig")
    app.run(debug=True)
