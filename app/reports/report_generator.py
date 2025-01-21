# app/reports/report_generator.py
# Module for generating Management Information (MI) reports.

from app.models.studio import Studio
from app.models.manager import StudioManager
from app.models.room import Room
from app.models.customer import Customer
from app.models.session import Session
from app import db

class ReportGenerator:
    """
    A class to encapsulate logic for generating various reports.
    """

    @staticmethod
    def generate_summary_report():
        """
        Generate a summary report containing high-level statistics.
        Returns:
            dict: A dictionary with summary metrics.
        """
        total_studios = Studio.query.count()
        total_managers = StudioManager.query.count()
        total_rooms = Room.query.count()
        total_customers = Customer.query.count()
        ongoing_sessions = Session.query.filter_by(status="ongoing").count()
        completed_sessions = Session.query.filter_by(status="completed").count()

        return {
            "total_studios": total_studios,
            "total_managers": total_managers,
            "total_rooms": total_rooms,
            "total_customers": total_customers,
            "ongoing_sessions": ongoing_sessions,
            "completed_sessions": completed_sessions
        }

    @staticmethod
    def studio_details_report():
        """
        Generate a detailed report for each studio, including its managers, rooms, and customers.
        Returns:
            list: A list of dictionaries with studio details.
        """
        studios = Studio.query.all()
        report = []

        for studio in studios:
            studio_data = {
                "studio_id": studio.id,
                "studio_name": studio.name,
                "address": studio.address,
                "phone_number": studio.phone_number,
                "managers": [
                    {"manager_id": m.id, "name": m.name, "email": m.email}
                    for m in studio.managers
                ],
                "rooms": [
                    {"room_id": r.id, "name": r.name, "availability": r.availability}
                    for r in studio.rooms
                ],
                "customers": [
                    {"customer_id": c.id, "name": c.name, "email": c.email}
                    for c in Customer.query.filter_by(studio_id=studio.id).all()
                ]
            }
            report.append(studio_data)

        return report

    @staticmethod
    def session_activity_report():
        """
        Generate a report on session activity, including ongoing and completed sessions.
        Returns:
            list: A list of dictionaries with session activity details.
        """
        sessions = Session.query.all()
        report = []

        for session in sessions:
            session_data = {
                "session_id": session.id,
                "room_id": session.room_id,
                "customer_id": session.customer_id,
                "start_time": session.start_time,
                "end_time": session.end_time,
                "status": session.status
            }
            report.append(session_data)

        return report

    @staticmethod
    def export_report(report_data, file_path):
        """
        Export the report data to a file (e.g., JSON or CSV).
        Args:
            report_data (list or dict): The data to export.
            file_path (str): The path to save the file.
        Returns:
            str: Confirmation message.
        """
        import json
        try:
            with open(file_path, 'w') as f:
                json.dump(report_data, f, indent=4)
            return f"Report successfully exported to {file_path}"
        except Exception as e:
            return f"Error exporting report: {str(e)}"
