# run.py

from flask import Flask
from app import create_app, db
from flask_migrate import Migrate
import click
from faker import Faker
from werkzeug.security import generate_password_hash
from app.models import Studio, User, Tenant

app = create_app()
migrate = Migrate(app, db)

@app.shell_context_processor
def make_shell_context():
    return {
        'db': db,
        'Studio': Studio,
        'User': User,
    }

@app.cli.command("seed")
def seed():
    """
    Seed the database with:
    - 2 studios
    - 1 Admin user
    - 1 Studio Manager, Staff/Instructor, Receptionist per studio
    """
    fake = Faker()

    # Create a tenant
    tenant = Tenant(name=fake.company(), subdomain=fake.unique.slug(), plan='free', is_active=True)
    db.session.add(tenant)
    db.session.flush()

    # Create Studios for the tenant
    studios = []
    for _ in range(2):
        s = Studio(tenant_id=tenant.id, name=fake.company())
        studios.append(s)
        db.session.add(s)
    db.session.flush()

    # Create Global Admin (no tenant)
    admin = User(
        name="Admin User",
        email="admin@example.com",
        password_hash=generate_password_hash("password"),
        role="Admin",
        permissions=["create_booking","edit_customer","view_reports","manage_staff"],
        studio_id=None,
        tenant_id=None
    )
    db.session.add(admin)

    # Other roles per studio within the tenant
    roles_perms = {
        "Studio Manager": ["view_reports","manage_staff"],
        "Staff/Instructor": ["create_booking"],
        "Receptionist": ["create_booking","edit_customer"]
    }
    for studio in studios:
        for role, perms in roles_perms.items():
            user = User(
                tenant_id=tenant.id,
                name=fake.name(),
                email=fake.unique.email(),
                password_hash=generate_password_hash("password"),
                role=role,
                permissions=perms,
                studio_id=studio.id
            )
            db.session.add(user)

    db.session.commit()
    click.echo("Seed data created successfully.")
