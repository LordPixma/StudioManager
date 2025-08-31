# Helper functions (e.g. date handling, email)
"""
Utility functions for standardized JSON responses and error handling.
"""

from flask import jsonify, session

def make_response_payload(success, data=None, message=None, errors=None, meta=None, conflicts=None):
    """
    Build a consistent JSON response payload.
    :param success: bool
    :param data: dict or list
    :param message: str
    :param errors: dict mapping field names to lists of error messages
    :param meta: dict for pagination metadata
    :param conflicts: list of conflict entries (e.g. booking overlaps)
    """
    payload = {"success": success}

    if data is not None:
        payload["data"] = data
    if message is not None:
        payload["message"] = message
    if errors is not None:
        payload["errors"] = errors
    if meta is not None:
        payload["meta"] = meta
    if conflicts is not None:
        payload["conflicts"] = conflicts

    return jsonify(payload)

def register_error_handlers(app):
    """
    Attach handlers for common HTTP errors to return JSON responses.
    """
    @app.errorhandler(400)
    def bad_request(error):
        return make_response_payload(False, message="Bad request"), 400

    @app.errorhandler(401)
    def unauthorized(error):
        return make_response_payload(False, message="Unauthorized"), 401

    @app.errorhandler(403)
    def forbidden(error):
        return make_response_payload(False, message="Forbidden"), 403

    @app.errorhandler(404)
    def not_found(error):
        return make_response_payload(False, message="Not found"), 404

    @app.errorhandler(500)
    def internal_error(error):
        return make_response_payload(False, message="Internal server error"), 500

def get_current_user():
    """Return the current logged-in user from session or None."""
    user_id = session.get('user_id')
    if not user_id:
        return None
    # Lazy import to avoid circular dependency at import time
    from .models import User
    return User.query.get(user_id)
