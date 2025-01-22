from app import create_app
import os

# Determine the configuration based on the environment
config_name = os.getenv('FLASK_CONFIG', 'DevelopmentConfig')

# Create the Flask application
app = create_app(config_name)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)))