from app import create_app
import os

# Determine the configuration based on the environment
config_name = os.getenv('FLASK_CONFIG', 'DevelopmentConfig')

# Create the Flask application
app = create_app(config_name)

if __name__ == "__main__":
    # Run the application
    app.run(debug=config_name.endswith('DevelopmentConfig'))