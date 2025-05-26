from flask import Blueprint, request, session
from sqlalchemy import or_
from datetime import datetime

from .. import db
from ..models import Customer, User
from ..utils import make_response_payload

customers_bp = Blueprint('customers_bp', __name__)


def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return None
    return User.query.get(user_id)


@customers_bp.route('', methods=['GET'])
def list_customers():
    user = get_current_user()
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    q = Customer.query
    if user.role != 'Admin':
        q = q.filter(Customer.studio_id == user.studio_id)

    # Search
    search = request.args.get('search')
    if search:
        ilike = f"%{search}%"
        q = q.filter(or_(Customer.name.ilike(ilike),
                         Customer.email.ilike(ilike)))

    # Sort
    sort = request.args.get('sort', 'name')
    order = request.args.get('order', 'asc').lower()
    sort_col = getattr(Customer, sort, Customer.name)
    q = q.order_by(sort_col.desc() if order == 'desc' else sort_col.asc())

    # Pagination
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 25))
    except ValueError:
        return make_response_payload(False, message="Invalid pagination params"), 400

    pag = q.paginate(page=page, per_page=per_page, error_out=False)
    data = [c.to_dict() for c in pag.items]
    meta = {
        "total_count": pag.total,
        "page": pag.page,
        "per_page": pag.per_page,
        "has_next": pag.has_next,
        "has_prev": pag.has_prev
    }

    return make_response_payload(True, data=data, meta=meta)


@customers_bp.route('/<int:customer_id>', methods=['GET'])
def get_customer(customer_id):
    user = get_current_user()
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    c = Customer.query.get(customer_id)
    if not c:
        return make_response_payload(False, message="Customer not found"), 404
    if user.role != 'Admin' and c.studio_id != user.studio_id:
        return make_response_payload(False, message="Forbidden"), 403

    return make_response_payload(True, data=c.to_dict())


@customers_bp.route('', methods=['POST'])
def create_customer():
    user = get_current_user()
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    payload = request.get_json() or {}
    errors = {}

    name = payload.get('name')
    email = payload.get('email')
    if not name:
        errors.setdefault('name', []).append('Name is required')
    if not email:
        errors.setdefault('email', []).append('Email is required')
    elif Customer.query.filter_by(email=email).first():
        errors.setdefault('email', []).append('Email already exists')

    if errors:
        return make_response_payload(False, message="Validation failed", errors=errors), 400

    new_customer = Customer(
        studio_id = user.studio_id if user.role != 'Admin' else payload.get('studio_id'),
        name      = name,
        email     = email,
        phone     = payload.get('phone'),
        notes     = payload.get('notes')
    )
    db.session.add(new_customer)
    db.session.commit()

    return make_response_payload(True,
                                 data=new_customer.to_dict(),
                                 message="Customer created successfully"), 201


@customers_bp.route('/<int:customer_id>', methods=['PUT'])
def update_customer(customer_id):
    user = get_current_user()
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    c = Customer.query.get(customer_id)
    if not c:
        return make_response_payload(False, message="Customer not found"), 404
    if user.role != 'Admin' and c.studio_id != user.studio_id:
        return make_response_payload(False, message="Forbidden"), 403

    payload = request.get_json() or {}
    errors = {}
    if 'email' in payload and payload['email'] != c.email:
        if Customer.query.filter_by(email=payload['email']).first():
            errors.setdefault('email', []).append('Email already exists')

    if errors:
        return make_response_payload(False, message="Validation failed", errors=errors), 400

    for field in ('name', 'email', 'phone', 'notes'):
        if field in payload:
            setattr(c, field, payload[field])
    db.session.commit()

    return make_response_payload(True,
                                 data=c.to_dict(),
                                 message="Customer updated successfully")


@customers_bp.route('/<int:customer_id>', methods=['DELETE'])
def delete_customer(customer_id):
    user = get_current_user()
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    c = Customer.query.get(customer_id)
    if not c:
        return make_response_payload(False, message="Customer not found"), 404
    if user.role != 'Admin' and c.studio_id != user.studio_id:
        return make_response_payload(False, message="Forbidden"), 403

    db.session.delete(c)
    db.session.commit()

    return make_response_payload(True, message="Customer deleted successfully")
