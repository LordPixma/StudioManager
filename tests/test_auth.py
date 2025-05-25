# Authentication tests
# tests/test_auth.py

import pytest
from app import create_app, db
from app.models import User
from werkzeug.security import generate_password_hash

@pytest.fixture
def client():
    app = create_app()
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "SESSION_COOKIE_SECURE": False,
    })
    with app.app_context():
        db.create_all()
        yield app.test_client()
        db.drop_all()

def test_register_and_duplicate(client):
    # initial registration
    res = client.post("/api/register", json={
        "name":"Test","email":"test@example.com","password":"password"
    })
    assert res.status_code == 201
    body = res.get_json()
    assert body["success"] is True
    assert "session_timeout" in body["data"]

    # duplicate email
    res2 = client.post("/api/register", json={
        "name":"Test2","email":"test@example.com","password":"password"
    })
    assert res2.status_code == 400
    assert res2.get_json()["errors"]["email"]

def test_login_logout_session(client):
    # seed a user
    pw_hash = generate_password_hash("password")
    user = User(name="U", email="u@example.com", password_hash=pw_hash,
                role="Receptionist", permissions=["create_booking"], studio_id=None)
    db.session.add(user)
    db.session.commit()

    # wrong password
    res = client.post("/api/login", json={"email":"u@example.com","password":"wrong"})
    assert res.status_code == 401

    # correct
    res2 = client.post("/api/login", json={
        "email":"u@example.com","password":"password","remember_me":False
    })
    assert res2.status_code == 200
    assert res2.get_json()["success"]

    # session info
    res3 = client.get("/api/session")
    assert res3.status_code == 200

    # logout
    res4 = client.post("/api/logout")
    assert res4.status_code == 200
    assert res4.get_json()["success"]

def test_validate_email(client):
    # no payload
    r1 = client.post("/api/validate/email", json={})
    assert r1.status_code == 400

    # unique
    r2 = client.post("/api/validate/email", json={"email":"a@b.com"})
    assert r2.status_code == 200

    # after user exists
    client.post("/api/register", json={
        "name":"X","email":"a@b.com","password":"password"
    })
    r3 = client.post("/api/validate/email", json={"email":"a@b.com"})
    assert r3.status_code == 400
