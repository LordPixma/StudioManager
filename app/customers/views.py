# app/customers/views.py

from flask import Blueprint, render_template, session, redirect, url_for

customers_ui_bp = Blueprint('customers_ui', __name__, template_folder='templates')

@customers_ui_bp.route('/customers', methods=['GET'])
def customer_list():
    if not session.get('user_id'):
        return redirect(url_for('ui.login'))
    return render_template('customers/list.html')

@customers_ui_bp.route('/customers/<int:customer_id>', methods=['GET'])
def customer_detail(customer_id):
    if not session.get('user_id'):
        return redirect(url_for('ui.login'))
    return render_template('customers/detail.html', customer_id=customer_id)
