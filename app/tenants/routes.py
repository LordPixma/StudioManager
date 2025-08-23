from flask import Blueprint, request
from werkzeug.security import generate_password_hash
from sqlalchemy import or_
from .. import db
from ..models import Tenant, Studio, User
from ..utils import make_response_payload, get_current_user
import re

tenants_bp = Blueprint('tenants', __name__)

@tenants_bp.route('', methods=['POST'])
def create_tenant():
    """
    Create a new tenant (SaaS registration).
    Creates tenant, default studio, and admin user.
    """
    data = request.get_json() or {}
    
    # Required fields
    tenant_name = data.get('tenant_name', '').strip()
    subdomain = data.get('subdomain', '').strip().lower()
    admin_name = data.get('admin_name', '').strip()
    admin_email = data.get('admin_email', '').strip().lower()
    admin_password = data.get('admin_password', '')
    plan = data.get('plan', 'free')

    # Validation
    errors = {}
    
    if not tenant_name:
        errors.setdefault('tenant_name', []).append('Tenant name is required')
    
    if not subdomain:
        # Generate subdomain from tenant name if not provided
        subdomain = re.sub(r'[^a-zA-Z0-9-]', '-', tenant_name.lower())[:20]
    
    if not re.match(r'^[a-zA-Z0-9-]+$', subdomain):
        errors.setdefault('subdomain', []).append('Subdomain can only contain letters, numbers, and hyphens')
    
    if len(subdomain) < 3:
        errors.setdefault('subdomain', []).append('Subdomain must be at least 3 characters long')
    
    # Check if subdomain already exists
    if Tenant.query.filter_by(subdomain=subdomain).first():
        errors.setdefault('subdomain', []).append('Subdomain already exists')
    
    if not admin_name:
        errors.setdefault('admin_name', []).append('Admin name is required')
    
    if not admin_email:
        errors.setdefault('admin_email', []).append('Admin email is required')
    elif not re.match(r'^[^@]+@[^@]+\.[^@]+$', admin_email):
        errors.setdefault('admin_email', []).append('Invalid email address')
    
    if not admin_password:
        errors.setdefault('admin_password', []).append('Admin password is required')
    elif len(admin_password) < 8:
        errors.setdefault('admin_password', []).append('Password must be at least 8 characters')
    
    # Check if admin email already exists (globally or in tenant)
    if User.query.filter_by(email=admin_email).first():
        errors.setdefault('admin_email', []).append('Email already exists')
    
    if errors:
        return make_response_payload(False, errors=errors), 400

    try:
        # Create tenant
        tenant = Tenant(
            name=tenant_name,
            subdomain=subdomain,
            plan=plan,
            is_active=True
        )
        db.session.add(tenant)
        db.session.flush()  # Get tenant ID

        # Create default studio for tenant
        studio = Studio(
            tenant_id=tenant.id,
            name=f"{tenant_name} - Main Studio"
        )
        db.session.add(studio)
        db.session.flush()  # Get studio ID

        # Create admin user
        admin_user = User(
            tenant_id=tenant.id,
            studio_id=studio.id,
            name=admin_name,
            email=admin_email,
            password_hash=generate_password_hash(admin_password),
            role='Studio Manager',  # Tenant admin role
            permissions=[
                'view_customers', 'create_customer', 'edit_customer', 'delete_customer',
                'view_bookings', 'create_booking', 'edit_booking', 'cancel_booking',
                'view_staff', 'create_staff', 'edit_staff',
                'view_reports', 'manage_studio'
            ]
        )
        db.session.add(admin_user)
        
        db.session.commit()

        return make_response_payload(
            True,
            data={
                "tenant": tenant.to_dict(),
                "studio": studio.to_dict(),
                "admin_user": admin_user.to_dict()
            },
            message="Tenant created successfully"
        ), 201

    except Exception as e:
        db.session.rollback()
        return make_response_payload(False, message=f"Failed to create tenant: {str(e)}"), 500

@tenants_bp.route('', methods=['GET'])
def list_tenants():
    """List all tenants (Admin only)."""
    user = get_current_user()
    if not user or user.role != 'Admin':
        return make_response_payload(False, message="Admin access required"), 403

    tenants = Tenant.query.all()
    return make_response_payload(
        True,
        data=[tenant.to_dict() for tenant in tenants]
    )

@tenants_bp.route('/<int:tenant_id>', methods=['GET'])
def get_tenant(tenant_id):
    """Get tenant details."""
    user = get_current_user()
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    # Users can only view their own tenant (unless Admin)
    if user.role != 'Admin' and user.tenant_id != tenant_id:
        return make_response_payload(False, message="Access denied"), 403

    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return make_response_payload(False, message="Tenant not found"), 404

    return make_response_payload(True, data=tenant.to_dict())

@tenants_bp.route('/<int:tenant_id>', methods=['PUT'])
def update_tenant(tenant_id):
    """Update tenant settings."""
    user = get_current_user()
    if not user:
        return make_response_payload(False, message="Unauthorized"), 401

    # Only tenant Studio Managers or global Admins can update
    if user.role not in ['Admin', 'Studio Manager'] or (user.tenant_id != tenant_id and user.role != 'Admin'):
        return make_response_payload(False, message="Access denied"), 403

    tenant = Tenant.query.get(tenant_id)
    if not tenant:
        return make_response_payload(False, message="Tenant not found"), 404

    data = request.get_json() or {}
    
    # Update allowed fields
    if 'name' in data and data['name'].strip():
        tenant.name = data['name'].strip()
    
    if 'settings' in data and isinstance(data['settings'], dict):
        tenant.settings = {**(tenant.settings or {}), **data['settings']}
    
    # Only global admins can change plan and active status
    if user.role == 'Admin':
        if 'plan' in data:
            tenant.plan = data['plan']
        if 'is_active' in data:
            tenant.is_active = bool(data['is_active'])

    try:
        db.session.commit()
        return make_response_payload(
            True,
            data=tenant.to_dict(),
            message="Tenant updated successfully"
        )
    except Exception as e:
        db.session.rollback()
        return make_response_payload(False, message=f"Failed to update tenant: {str(e)}"), 500