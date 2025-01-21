from app.models.studio import Studio
from app.models.manager import StudioManager
from app.models.room import Room
from app.models.customer import Customer


def validate_studio_exists(studio_id):
    """
    Validate if a studio exists.
    """
    studio = Studio.query.get(studio_id)
    if not studio:
        return False, "Studio not found."
    return True, studio


def validate_manager_exists(manager_id):
    """
    Validate if a manager exists.
    """
    manager = StudioManager.query.get(manager_id)
    if not manager:
        return False, "Manager not found."
    return True, manager


def validate_room_exists(room_id):
    """
    Validate if a room exists.
    """
    room = Room.query.get(room_id)
    if not room:
        return False, "Room not found."
    return True, room


def validate_customer_exists(customer_id):
    """
    Validate if a customer exists.
    """
    customer = Customer.query.get(customer_id)
    if not customer:
        return False, "Customer not found."
    return True, customer


def validate_email_unique(email, manager_id=None):
    """
    Validate if an email is unique for managers.
    Optionally exclude a specific manager by ID.
    """
    query = StudioManager.query.filter_by(email=email)
    if manager_id:
        query = query.filter(StudioManager.id != manager_id)
    if query.first():
        return False, "Email is already in use."
    return True, "Email is unique."


def validate_phone_number(phone_number):
    """
    Validate if the phone number is in a valid format.
    """
    if not phone_number or len(phone_number) < 10 or not phone_number.isdigit():
        return False, "Invalid phone number."
    return True, "Valid phone number."


def validate_password_strength(password):
    """
    Validate if the password meets strength requirements.
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not any(char.isdigit() for char in password):
        return False, "Password must contain at least one digit."
    if not any(char.isupper() for char in password):
        return False, "Password must contain at least one uppercase letter."
    return True, "Password is strong."
