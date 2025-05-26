from flask import Blueprint, render_template, redirect, url_for, session

ui_bp = Blueprint('ui', __name__, template_folder='templates')

@ui_bp.route('/')
def root():
    # Redirect bare‐root to the login page
    return redirect(url_for('ui.login'))

@ui_bp.route('/auth/login', methods=['GET'])
def login():
    return render_template('auth/login.html')

@ui_bp.route('/auth/register', methods=['GET'])
def register():
    return render_template('auth/register.html')

@ui_bp.route('/dashboard', methods=['GET'])
def dashboard():
    # Protect dashboard: require login
    if not session.get('user_id'):
        return redirect(url_for('ui.login'))
    # Use the reports dashboard template for now
    return render_template('reports/dashboard.html')