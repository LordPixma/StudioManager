# run.py

from app import create_app, db
from flask_migrate import Migrate

app = create_app()
migrate = Migrate(app, db)

# Optional: handy shell context so `flask shell` pre-imports your db and models
@app.shell_context_processor
def make_shell_context():
    from app.models import Studio, User
    return {
        'db': db,
        'Studio': Studio,
        'User': User,
    }
