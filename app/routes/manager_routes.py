from flask import Blueprint, request, flash, jsonify, render_template, redirect, url_for, session
from app.models.room import Room
from app.models.customer import Customer
from app.models.session import Session
from app.models.manager import StudioManager
from app import db
from werkzeug.security import check_password_hash, generate_password_hash
from datetime import datetime
from functools import wraps
import json

manager_routes = Blueprint('manager_routes', __name__)

# Helper Functions
def get_current_manager():
    """Get the currently logged-in manager"""
    if 'manager_id' in session:
        return StudioManager.query.get(session['manager_id'])
    return None

def login_required(f):
    """Decorator to require manager login for routes"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'manager_id' not in session:
            return redirect(url_for('manager_routes.manager_login'))
        return f(*args, **kwargs)
    return decorated_function

@manager_routes.app_template_filter('from_json')
def from_json(value):
    try:
        return json.loads(value) if value else {}
    except:
        return {}

# Authentication Routes
@manager_routes.route('/update_room_availability', methods=['POST'])
@login_required
def update_room_availability():
    current_manager = get_current_manager()
    room_id = request.form.get('room_id')
    room = Room.query.filter_by(id=room_id, studio_id=current_manager.studio_id).first()
    
    if not room:
        flash('Room not found', 'error')
        return redirect(url_for('manager_routes.manage_availability'))
        
    try:
        date = request.form.get('date')
        time = request.form.get('time')
        status = request.form.get('status')
        customer_id = request.form.get('customer_id')
        
        # Load existing availability
        availability = json.loads(room.availability or '{}')
        if date not in availability:
            availability[date] = {}
            
        slot_info = {'status': status}
        if customer_id and status == 'booked':
            customer = Customer.query.get(customer_id)
            if customer:
                slot_info['customer_id'] = customer_id
                slot_info['customer_name'] = customer.name
                
        availability[date][time] = slot_info
        room.availability = json.dumps(availability)
        db.session.commit()
        flash('Availability updated successfully', 'success')
        
    except Exception as e:
        db.session.rollback()
        flash(f'Error updating availability: {str(e)}', 'error')
    
    return redirect(url_for('manager_routes.manage_availability'))


@manager_routes.route('/login', methods=['GET', 'POST'])
def manager_login():
    if request.method == 'POST':
        data = request.form
        email = data.get('email')
        password = data.get('password')
        
        manager = StudioManager.query.filter_by(email=email).first()
        
        if not manager:
            return render_template('manager_login.html', error="No account found with this email")
            
        if not check_password_hash(manager.password, password):
            return render_template('manager_login.html', error="Invalid password")
            
        session['manager_id'] = manager.id
        session['role'] = 'manager'
        
        return redirect(url_for('manager_routes.manager_dashboard'))

    return render_template('manager_login.html')

# Profile Management Routes
@manager_routes.route('/profile')
@login_required
def profile():
    current_manager = get_current_manager()
    return render_template('manager_profile.html', manager=current_manager)

@manager_routes.route('/profile/update', methods=['POST'])
@login_required
def update_profile():
    current_manager = get_current_manager()
    
    try:
        current_manager.name = request.form['name']
        current_manager.email = request.form['email']
        
        # Handle password update
        new_password = request.form.get('new_password')
        if new_password:
            if not check_password_hash(current_manager.password, request.form['current_password']):
                return render_template('manager_profile.html', 
                                    manager=current_manager, 
                                    error="Current password is incorrect")
            current_manager.password = generate_password_hash(new_password)
        
        db.session.commit()
        return render_template('manager_profile.html', 
                             manager=current_manager, 
                             success="Profile updated successfully")
    except Exception as e:
        db.session.rollback()
        return render_template('manager_profile.html', 
                             manager=current_manager, 
                             error=str(e))

# Dashboard Routes
@manager_routes.route('/')
@login_required
def manager_dashboard():
    current_manager = get_current_manager()
    studio_id = current_manager.studio_id
    
    # Get dashboard statistics
    rooms_count = Room.query.filter_by(studio_id=studio_id).count()
    customers_count = Customer.query.filter_by(studio_id=studio_id).count()
    active_sessions = Session.query.join(Room).filter(
        Room.studio_id == studio_id,
        Session.status == "ongoing"
    ).count()
    
    return render_template('manager_dashboard.html',
                         current_manager=current_manager,
                         rooms_count=rooms_count,
                         customers_count=customers_count,
                         active_sessions=active_sessions)

# Room Management Routes
@manager_routes.route('/manage_rooms')
@login_required
def manage_rooms():
    current_manager = get_current_manager()
    rooms = Room.query.filter_by(studio_id=current_manager.studio_id).all()
    return render_template('manage_rooms.html', rooms=rooms, current_manager=current_manager)

@manager_routes.route('/manage_availability')
@login_required
def manage_availability():
    current_manager = get_current_manager()
    rooms = Room.query.filter_by(studio_id=current_manager.studio_id).all()
    customers = Customer.query.filter_by(studio_id=current_manager.studio_id).all()
    
    return render_template('manage_availability.html',
                         rooms=rooms,
                         customers=customers)

@manager_routes.route('/api/rooms/<int:room_id>/availability', methods=['GET'])
@login_required
def get_room_availability(room_id):
    current_manager = get_current_manager()
    room = Room.query.filter_by(id=room_id, studio_id=current_manager.studio_id).first()
    
    if not room:
        return jsonify({"error": "Room not found"}), 404
        
    # Parse the availability JSON from the database
    availability = {}
    if room.availability:
        try:
            availability = json.loads(room.availability)
        except json.JSONDecodeError:
            availability = {}
            
    return jsonify({"availability": availability})

@manager_routes.route('/add_room', methods=['POST'])
@login_required
def add_room():
    current_manager = get_current_manager()
    data = request.get_json()
    try:
        new_room = Room(
            name=data['name'],
            studio_id=current_manager.studio_id,
            availability=data.get('availability')
        )
        db.session.add(new_room)
        db.session.commit()
        return jsonify({"message": "Room added successfully", "room_id": new_room.id}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@manager_routes.route('/remove_room', methods=['POST'])  # Only POST method
@login_required
def remove_room():
    current_manager = get_current_manager()
    try:
        # Handle both form data and JSON request
        if request.is_json:
            room_id = request.json.get('room_id')
        else:
            room_id = request.form.get('room_id')
        
        if not room_id:
            return jsonify({"error": "Room ID is required"}), 400

        room = Room.query.filter_by(
            id=room_id, 
            studio_id=current_manager.studio_id
        ).first()
        
        if not room:
            return jsonify({"error": "Room not found"}), 404

        # Check if room has any ongoing sessions
        has_sessions = Session.query.filter_by(
            room_id=room.id, 
            status='ongoing'
        ).first()
        
        if has_sessions:
            return jsonify({"error": "Cannot delete room with ongoing sessions"}), 400

        db.session.delete(room)
        db.session.commit()
        
        return jsonify({"message": "Room removed successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"error": str(e)}), 500

@manager_routes.route('/add_room_availability', methods=['PUT'])
@login_required
def add_room_availability():
    current_manager = get_current_manager()
    data = request.get_json()
    try:
        room = Room.query.filter_by(id=data['room_id'], studio_id=current_manager.studio_id).first()
        if not room:
            return jsonify({"error": "Room not found"}), 404

        room.availability = data['availability']
        db.session.commit()
        return jsonify({"message": "Room availability updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Customer Management Routes
@manager_routes.route('/manage_customers')
@login_required
def manage_customers():
    current_manager = get_current_manager()
    customers = Customer.query.filter_by(studio_id=current_manager.studio_id).all()
    return render_template('manage_customers.html', customers=customers, current_manager=current_manager)

@manager_routes.route('/add_customer', methods=['POST'])
@login_required
def add_customer():
    current_manager = get_current_manager()
    data = request.form
    try:
        new_customer = Customer(
            name=data['name'],
            email=data['email'],
            phone_number=data.get('phone_number'),
            studio_id=current_manager.studio_id
        )
        db.session.add(new_customer)
        db.session.commit()
        flash('Customer added successfully', 'success')
        return redirect(url_for('manager_routes.manage_customers'))
    except Exception as e:
        db.session.rollback()
        flash(str(e), 'error')
        return redirect(url_for('manager_routes.manage_customers'))

@manager_routes.route('/remove_customer', methods=['POST'])
@login_required
def remove_customer():
    current_manager = get_current_manager()
    customer_id = request.form.get('customer_id')
    
    try:
        customer = Customer.query.filter_by(
            id=customer_id, 
            studio_id=current_manager.studio_id
        ).first()
        
        if not customer:
            flash('Customer not found', 'error')
            return redirect(url_for('manager_routes.manage_customers'))

        db.session.delete(customer)
        db.session.commit()
        
        flash('Customer removed successfully', 'success')
        return redirect(url_for('manager_routes.manage_customers'))
        
    except Exception as e:
        db.session.rollback()
        flash(str(e), 'error')
        return redirect(url_for('manager_routes.manage_customers'))

@manager_routes.route('/update_customer', methods=['PUT'])
@login_required
def update_customer():
    current_manager = get_current_manager()
    data = request.form
    try:
        customer = Customer.query.filter_by(id=data['customer_id'], studio_id=current_manager.studio_id).first()
        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        customer.name = data.get('name', customer.name)
        customer.email = data.get('email', customer.email)
        customer.phone_number = data.get('phone_number', customer.phone_number)
        db.session.commit()
        return jsonify({"message": "Customer updated successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 400

# Session Management Routes
@manager_routes.route('/sessions')
@login_required
def manager_sessions():
    current_manager = get_current_manager()
    
    # Get rooms for this manager's studio
    rooms = Room.query.filter_by(studio_id=current_manager.studio_id).all()
    
    # Get customers for this manager's studio
    customers = Customer.query.filter_by(studio_id=current_manager.studio_id).all()
    
    # Get ongoing and completed sessions
    ongoing = Session.query.join(Room).filter(
        Room.studio_id == current_manager.studio_id,
        Session.status == 'ongoing'
    ).all()
    
    completed = Session.query.join(Room).filter(
        Room.studio_id == current_manager.studio_id,
        Session.status == 'completed'
    ).all()

    print(f"Rooms available: {[room.name for room in rooms]}")
    print(f"Customers available: {[customer.name for customer in customers]}")

    return render_template('sessions.html',
                         rooms=rooms,
                         customers=customers,
                         ongoing_sessions=ongoing,
                         completed_sessions=completed,
                         current_manager=current_manager)

@manager_routes.route('/book_session', methods=['POST'])
@login_required
def book_session():
    current_manager = get_current_manager()
    data = request.form
    try:
        room = Room.query.filter_by(id=data['room_id'], studio_id=current_manager.studio_id).first()
        customer = Customer.query.filter_by(id=data['customer_id'], studio_id=current_manager.studio_id).first()

        if not room:
            return jsonify({"error": "Room not found"}), 404
        if not customer:
            return jsonify({"error": "Customer not found"}), 404

        start_time = data.get('start_time', datetime.utcnow())
        new_session = Session(
            room_id=room.id,
            customer_id=customer.id,
            start_time=start_time,
        )
        db.session.add(new_session)
        db.session.commit()
        return jsonify({"message": "Session booked successfully", "session_id": new_session.id}), 201

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@manager_routes.route('/end_session', methods=['PUT'])
@login_required
def end_session():
    current_manager = get_current_manager()
    data = request.get_json()
    try:
        session = Session.query.join(Room).filter(
            Session.id == data['session_id'],
            Room.studio_id == current_manager.studio_id
        ).first()

        if not session:
            return jsonify({"error": "Session not found"}), 404
        if session.status == "completed":
            return jsonify({"error": "Session is already completed"}), 400

        session.end_time = datetime.utcnow()
        session.status = "completed"
        db.session.commit()
        return jsonify({"message": "Session ended successfully"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 400

@manager_routes.route('/view_sessions', methods=['GET'])
@login_required
def view_sessions():
    current_manager = get_current_manager()
    room_id = request.args.get('room_id')
    customer_id = request.args.get('customer_id')
    try:
        # Base query that ensures we only get sessions from the manager's studio
        base_query = Session.query.join(Room).filter(Room.studio_id == current_manager.studio_id)
        
        if room_id:
            sessions = base_query.filter(Session.room_id == room_id).all()
        elif customer_id:
            sessions = base_query.filter(Session.customer_id == customer_id).all()
        else:
            return jsonify({"error": "Provide either room_id or customer_id"}), 400

        sessions_report = [
            {
                "session_id": s.id,
                "room_id": s.room_id,
                "customer_id": s.customer_id,
                "start_time": s.start_time,
                "end_time": s.end_time,
                "status": s.status,
            }
            for s in sessions
        ]
        return jsonify({"sessions": sessions_report}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500
    

@manager_routes.route('/logout')
@login_required
def logout():
    session.clear()
    return redirect(url_for('manager_routes.manager_login'))