from flask import Blueprint, request, jsonify, render_template, redirect, url_for, session, flash
from app.models.studio import Studio
from app.models.manager import StudioManager
from app.models.room import Room
from app.models.customer import Customer
from app.models.session import Session
from app.reports.report_generator import ReportGenerator
from werkzeug.security import generate_password_hash, check_password_hash
from app import db
import random
import string

admin_routes = Blueprint('admin_routes', __name__)

@admin_routes.route('/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == 'POST':
        data = request.form
        email = data.get('email')
        password = data.get('password')
        
        # Find admin user by email
        admin = StudioManager.query.filter_by(email=email, studio_id=None).first()
        
        if not admin:
            return render_template('admin_login.html', error="No admin account found with this email")
            
        if not check_password_hash(admin.password, password):
            return render_template('admin_login.html', error="Invalid password")
            
        # Set up session for the logged in admin
        session['admin_id'] = admin.id
        session['role'] = 'admin'
        
        return redirect(url_for('admin_routes.admin_dashboard'))

    return render_template('admin_login.html')

@admin_routes.route('/')
def admin_dashboard():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
    return render_template('admin_dashboard.html')

@admin_routes.route('/create_studio', methods=['GET', 'POST'])
def create_studio():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    if request.method == 'POST':
        data = request.form
        new_studio = Studio(
            name=data['name'],
            address=data['address'],
            phone_number=data.get('phone_number')
        )
        db.session.add(new_studio)
        db.session.commit()
        return redirect(url_for('admin_routes.admin_dashboard'))

    return render_template('create_studio.html')


@admin_routes.route('/reports')
def admin_reports():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    summary = ReportGenerator.generate_summary_report()
    details = ReportGenerator.studio_details_report()
    sessions = ReportGenerator.session_activity_report()

    return render_template(
        'reports.html',
        summary_report=summary,
        studio_details=details,
        session_activity=sessions
    )

@admin_routes.route('/create_studio_manager', methods=['GET', 'POST'])
def create_studio_manager():
    studios = Studio.query.all()

    if request.method == 'POST':
        data = request.form
        studio = Studio.query.get(data['studio_id'])
        if not studio:
            return jsonify({"error": "Studio not found"}), 404

        new_manager = StudioManager(
            name=data['name'],
            email=data['email'],
            password=data['password'],  # Use hashed passwords in production!
            studio_id=studio.id
        )
        db.session.add(new_manager)
        db.session.commit()
        return redirect(url_for('admin_routes.admin_dashboard'))

    return render_template('create_studio_manager.html', studios=studios)

@admin_routes.route('/edit_studio/<int:studio_id>', methods=['GET', 'POST'])
def edit_studio(studio_id):
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    studio = Studio.query.get_or_404(studio_id)

    if request.method == 'POST':
        data = request.form
        studio.name = data.get('name', studio.name)
        studio.address = data.get('address', studio.address)
        studio.phone_number = data.get('phone_number', studio.phone_number)
        db.session.commit()
        return redirect(url_for('admin_routes.admin_dashboard'))

    return render_template('edit_studio.html', studio=studio)

@admin_routes.route('/edit-manager/<int:manager_id>', methods=['GET', 'POST'])
def edit_studio_manager(manager_id):
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    manager = StudioManager.query.get_or_404(manager_id)
    studios = Studio.query.all()
    
    if request.method == 'POST':
        try:
            manager.name = request.form['name']
            manager.email = request.form['email']
            manager.studio_id = request.form['studio_id']
            
            db.session.commit()
            return redirect(url_for('admin_routes.manage_managers'))
        except Exception as e:
            db.session.rollback()
            return render_template('edit_studio_manager.html', 
                                manager=manager, 
                                studios=studios, 
                                error=str(e))
    
    return render_template('edit_studio_manager.html', 
                         manager=manager, 
                         studios=studios)


@admin_routes.route('/manage-studios')
def manage_studios():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    # Get all studios with their managers
    studios = Studio.query.all()
    return render_template('manage_studios.html', studios=studios)


@admin_routes.route('/delete-studio/<int:studio_id>', methods=['POST'])
def delete_studio(studio_id):
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    studio = Studio.query.get_or_404(studio_id)
    
    # Check if studio has any managers
    if studio.managers:
        return jsonify({
            "success": False,
            "message": "Cannot delete studio with assigned managers. Please remove managers first."
        }), 400
        
    try:
        db.session.delete(studio)
        db.session.commit()
        return jsonify({"success": True, "message": "Studio deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@admin_routes.route('/manage-managers')
def manage_managers():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    # Get all managers with their studios
    managers = StudioManager.query.filter(StudioManager.studio_id.isnot(None)).all()
    return render_template('manage_managers.html', managers=managers)

@admin_routes.route('/delete-manager/<int:manager_id>', methods=['POST'])
def delete_manager(manager_id):
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    manager = StudioManager.query.get_or_404(manager_id)
    
    try:
        db.session.delete(manager)
        db.session.commit()
        return jsonify({"success": True, "message": "Manager deleted successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"success": False, "message": str(e)}), 500

@admin_routes.route('/reset-manager-password/<int:manager_id>', methods=['POST'])
def reset_manager_password(manager_id):
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
        
    manager = StudioManager.query.get_or_404(manager_id)
    
    try:
        # Generate a new random password (12 characters)
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(random.choice(chars) for _ in range(12))
        
        # Hash the new password
        hashed_password = generate_password_hash(new_password)
        
        # Update the manager's password
        manager.password = hashed_password
        db.session.commit()
        
        return jsonify({
            "success": True, 
            "message": "Password reset successfully",
            "new_password": new_password
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False, 
            "message": f"Error resetting password: {str(e)}"
        }), 500

@admin_routes.route('/run_reports', methods=['GET'])
def run_reports():
    try:
        summary = ReportGenerator.generate_summary_report()
        details = ReportGenerator.studio_details_report()
        sessions = ReportGenerator.session_activity_report()

        return jsonify({
            "summary": summary,
            "details": details,
            "sessions": sessions
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@admin_routes.route('/settings')
def admin_settings():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
    
    current_admin = StudioManager.query.get(session['admin_id'])
    admins = StudioManager.query.filter_by(studio_id=None).all()
    
    return render_template('admin_settings.html', 
                         current_admin=current_admin,
                         admins=admins)

@admin_routes.route('/update-admin-profile', methods=['POST'])
def update_admin_profile():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
    
    current_admin = StudioManager.query.get(session['admin_id'])
    
    try:
        if request.form.get('current_password'):
            if not check_password_hash(current_admin.password, request.form['current_password']):
                flash('Current password is incorrect', 'error')
                return redirect(url_for('admin_routes.admin_settings'))
            
            current_admin.password = generate_password_hash(request.form['new_password'])
        
        current_admin.name = request.form['name']
        current_admin.email = request.form['email']
        
        db.session.commit()
        flash('Profile updated successfully', 'success')
        
    except Exception as e:
        db.session.rollback()
        flash(str(e), 'error')
    
    return redirect(url_for('admin_routes.admin_settings'))

from app.utils.validators import validate_admin_email_unique, validate_admin_exists, validate_min_admin_count

@admin_routes.route('/add-admin', methods=['POST'])
def add_admin():
    if 'admin_id' not in session:
        return redirect(url_for('admin_routes.admin_login'))
    
    try:
        # Validate email uniqueness
        is_unique, message = validate_admin_email_unique(request.form['email'])
        if not is_unique:
            flash(message, 'error')
            return redirect(url_for('admin_routes.admin_settings'))
            
        # Create new admin (studio_id=None indicates admin user)
        new_admin = StudioManager(
            name=request.form['name'],
            email=request.form['email'],
            password=generate_password_hash(request.form['password']),
            studio_id=None
        )
        
        db.session.add(new_admin)
        db.session.commit()
        flash('Admin user added successfully', 'success')
        
    except Exception as e:
        db.session.rollback()
        flash(str(e), 'error')
    
    return redirect(url_for('admin_routes.admin_settings'))

@admin_routes.route('/reset-admin-password/<int:admin_id>', methods=['POST'])
def reset_admin_password(admin_id):
    if 'admin_id' not in session:
        return jsonify({"success": False, "message": "Not authorized"}), 401
    
    admin = StudioManager.query.get_or_404(admin_id)
    
    try:
        # Generate a new random password (12 characters)
        chars = string.ascii_letters + string.digits + "!@#$%^&*"
        new_password = ''.join(random.choice(chars) for _ in range(12))
        
        # Hash the new password
        admin.password = generate_password_hash(new_password)
        db.session.commit()
        
        return jsonify({
            "success": True,
            "message": "Password reset successfully",
            "new_password": new_password
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Error resetting password: {str(e)}"
        }), 500


@admin_routes.route('/remove-admin/<int:admin_id>', methods=['POST'])
def remove_admin(admin_id):
    if 'admin_id' not in session:
        return jsonify({"success": False, "message": "Not authorized"}), 401
    
    if int(session['admin_id']) == admin_id:
        return jsonify({
            "success": False,
            "message": "Cannot remove your own admin account"
        }), 400
    
    # Verify the admin exists and is actually an admin (studio_id is None)
    admin = StudioManager.query.filter_by(id=admin_id, studio_id=None).first()
    if not admin:
        return jsonify({
            "success": False,
            "message": "Admin not found"
        }), 404
    
    # Check if this would remove the last admin
    admin_count = StudioManager.query.filter_by(studio_id=None).count()
    if admin_count <= 1:
        return jsonify({
            "success": False,
            "message": "Cannot remove the last admin account"
        }), 400
    
    try:
        db.session.delete(admin)
        db.session.commit()
        return jsonify({
            "success": True,
            "message": "Admin removed successfully"
        })
    except Exception as e:
        db.session.rollback()
        return jsonify({
            "success": False,
            "message": f"Error removing admin: {str(e)}"
        }), 500