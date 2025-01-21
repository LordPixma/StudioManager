# app/reports/advanced_report_generator.py
import json
import csv
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sqlalchemy import func, extract
from datetime import datetime, timedelta
from typing import Dict, List, Any

from app import db
from app.models.studio import Studio
from app.models.room import Room
from app.models.session import Session
from app.models.customer import Customer

class AdvancedReportGenerator:
    """
    Enhanced reporting class with advanced analytics and visualization capabilities
    """

    @classmethod
    def generate_occupancy_report(cls, studio_id: int, start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        """
        Generate detailed session occupancy report for a specific studio
        
        Args:
            studio_id (int): ID of the studio to generate report for
            start_date (datetime, optional): Start date for the report
            end_date (datetime, optional): End date for the report
        
        Returns:
            Dict containing occupancy metrics
        """
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Get rooms for the studio
        rooms = Room.query.filter_by(studio_id=studio_id).all()
        
        # Calculate occupancy metrics
        occupancy_data = {
            'total_rooms': len(rooms),
            'rooms_details': []
        }

        total_room_hours = 0
        total_occupied_hours = 0

        for room in rooms:
            # Get sessions for this room within the date range
            room_sessions = Session.query.filter(
                Session.room_id == room.id,
                Session.start_time >= start_date,
                Session.start_time <= end_date
            ).all()

            # Calculate room-specific occupancy
            room_total_hours = (end_date - start_date).total_seconds() / 3600
            room_occupied_hours = sum(
                (session.end_time or datetime.utcnow()) - session.start_time
            ).total_seconds() / 3600 for session in room_sessions

            occupancy_percentage = (room_occupied_hours / room_total_hours) * 100 if room_total_hours > 0 else 0

            room_data = {
                'room_id': room.id,
                'room_name': room.name,
                'total_sessions': len(room_sessions),
                'occupied_hours': room_occupied_hours,
                'occupancy_percentage': round(occupancy_percentage, 2)
            }

            occupancy_data['rooms_details'].append(room_data)

            total_room_hours += room_total_hours
            total_occupied_hours += room_occupied_hours

        # Overall studio occupancy
        occupancy_data['overall_occupancy_percentage'] = round(
            (total_occupied_hours / total_room_hours) * 100 if total_room_hours > 0 else 0, 2
        )

        return occupancy_data

    @classmethod
    def generate_revenue_report(cls, studio_id: int, start_date: datetime = None, end_date: datetime = None) -> Dict[str, Any]:
        """
        Generate revenue report for a specific studio
        
        Args:
            studio_id (int): ID of the studio to generate report for
            start_date (datetime, optional): Start date for the report
            end_date (datetime, optional): End date for the report
        
        Returns:
            Dict containing revenue metrics
        """
        # Default to last 30 days if no dates provided
        if not start_date:
            start_date = datetime.utcnow() - timedelta(days=30)
        if not end_date:
            end_date = datetime.utcnow()

        # Assume a base rate per hour for room booking
        BASE_HOURLY_RATE = 50  # You might want to make this configurable

        # Get rooms for the studio
        rooms = Room.query.filter_by(studio_id=studio_id).all()
        
        revenue_data = {
            'total_revenue': 0,
            'rooms_revenue': []
        }

        for room in rooms:
            # Get sessions for this room within the date range
            room_sessions = Session.query.filter(
                Session.room_id == room.id,
                Session.start_time >= start_date,
                Session.start_time <= end_date,
                Session.status == 'completed'
            ).all()

            # Calculate revenue for this room
            room_revenue = sum(
                ((session.end_time - session.start_time).total_seconds() / 3600) * BASE_HOURLY_RATE 
                for session in room_sessions
            )

            room_data = {
                'room_id': room.id,
                'room_name': room.name,
                'total_sessions': len(room_sessions),
                'room_revenue': round(room_revenue, 2)
            }

            revenue_data['rooms_revenue'].append(room_data)
            revenue_data['total_revenue'] += room_revenue

        revenue_data['total_revenue'] = round(revenue_data['total_revenue'], 2)

        return revenue_data

    @classmethod
    def generate_customer_retention_report(cls, studio_id: int, months: int = 6) -> Dict[str, Any]:
        """
        Generate customer retention metrics
        
        Args:
            studio_id (int): ID of the studio to generate report for
            months (int, optional): Number of months to analyze
        
        Returns:
            Dict containing customer retention metrics
        """
        # Get customers for the studio
        customers = Customer.query.filter_by(studio_id=studio_id).all()
        
        retention_data = {
            'total_customers': len(customers),
            'customer_retention_details': []
        }

        # Calculate retention for each customer
        for customer in customers:
            # Get customer's session history
            sessions = Session.query.filter(
                Session.customer_id == customer.id,
                Session.start_time >= datetime.utcnow() - timedelta(days=months*30)
            ).all()

            # Calculate session frequency
            session_dates = [session.start_time for session in sessions]
            
            # Find time between sessions
            if len(session_dates) > 1:
                session_intervals = [
                    (session_dates[i+1] - session_dates[i]).days 
                    for i in range(len(session_dates)-1)
                ]
                avg_interval = sum(session_intervals) / len(session_intervals)
            else:
                avg_interval = None

            customer_data = {
                'customer_id': customer.id,
                'customer_name': customer.name,
                'total_sessions': len(sessions),
                'avg_session_interval_days': round(avg_interval, 2) if avg_interval else None,
                'last_session_date': max(session_dates).strftime('%Y-%m-%d') if sessions else None
            }

            retention_data['customer_retention_details'].append(customer_data)

        return retention_data

    @classmethod
    def predict_booking_trends(cls, studio_id: int, months: int = 6) -> Dict[str, Any]:
        """
        Implement basic predictive analytics for booking trends
        
        Args:
            studio_id (int): ID of the studio to analyze
            months (int, optional): Number of months to analyze for prediction
        
        Returns:
            Dict containing booking trend predictions
        """
        # Get historical session data
        sessions = Session.query.filter(
            Session.room_id.in_([r.id for r in Room.query.filter_by(studio_id=studio_id).all()]),
            Session.start_time >= datetime.utcnow() - timedelta(days=months*30)
        ).all()

        # Prepare data for trend analysis
        session_data = pd.DataFrame([
            {
                'date': session.start_time.replace(day=1),  # Group by month
                'day_of_week': session.start_time.weekday(),
                'hour': session.start_time.hour
            } for session in sessions
        ])

        # Analyze booking trends
        trends = {
            'monthly_booking_trend': session_data.groupby('date').size().to_dict(),
            'day_of_week_trend': session_data.groupby('day_of_week').size().to_dict(),
            'hourly_trend': session_data.groupby('hour').size().to_dict()
        }

        # Simple prediction (naive approach)
        future_predictions = {}
        for key, trend in trends.items():
            if trend:
                # Calculate average and project forward
                avg = sum(trend.values()) / len(trend)
                future_predictions[key] = {
                    'average': round(avg, 2),
                    'projected_increase': round(avg * 1.1, 2)  # 10% projected increase
                }

        return {
            'historical_trends': trends,
            'predictions': future_predictions
        }

    @classmethod
    def export_report(cls, report_data: Dict[str, Any], export_format: str = 'csv', filename: str = 'report') -> str:
        """
        Export report data to CSV or JSON
        
        Args:
            report_data (Dict): Report data to export
            export_format (str): Format to export (csv or json)
            filename (str): Base filename for export
        
        Returns:
            str: Path to exported file
        """
        # Ensure export directory exists
        import os
        export_dir = 'exports'
        os.makedirs(export_dir, exist_ok=True)

        # Generate full filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        full_filename = f"{export_dir}/{filename}_{timestamp}"

        if export_format.lower() == 'csv':
            # Flatten nested dictionary for CSV export
            def flatten_dict(d, parent_key='', sep='_'):
                items = []
                for k, v in d.items():
                    new_key = f"{parent_key}{sep}{k}" if parent_key else k
                    
                    if isinstance(v, dict):
                        items.extend(flatten_dict(v, new_key, sep=sep).items())
                    elif isinstance(v, list):
                        for i, item in enumerate(v):
                            if isinstance(item, dict):
                                items.extend(flatten_dict(item, f"{new_key}_{i}", sep=sep).items())
                            else:
                                items.append((f"{new_key}_{i}", item))
                    else:
                        items.append((new_key, v))
                return dict(items)

            # Flatten the report data
            flattened_data = [flatten_dict(item) if isinstance(item, dict) else item for item in (report_data if isinstance(report_data, list) else [report_data])]

            # Write to CSV
            output_file = f"{full_filename}.csv"
            with open(output_file, 'w', newline='') as csvfile:
                if flattened_data:
                    fieldnames = set().union(*(d.keys() for d in flattened_data))
                    writer = csv.DictWriter(csvfile, fieldnames=sorted(fieldnames))
                    writer.writeheader()
                    for row in flattened_data:
                        writer.writerow(row)

        elif export_format.lower() == 'json':
            # Write to JSON
            output_file = f"{full_filename}.json"
            with open(output_file, 'w') as jsonfile:
                json.dump(report_data, jsonfile, indent=4, default=str)

        return output_file

    @classmethod
    def visualize_report(cls, report_data: Dict[str, Any], report_type: str) -> str:
        """
        Create visualizations for different report types
        
        Args:
            report_data (Dict): Report data to visualize
            report_type (str): Type of report to visualize
        
        Returns:
            str: Path to saved visualization
        """
        # Ensure visualization directory exists
        import os
        viz_dir = 'visualizations'
        os.makedirs(viz_dir, exist_ok=True)

        # Generate filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        plt.figure(figsize=(10, 6))
        plt.title(f"{report_type.replace('_', ' ').title()} Visualization")

        if report_type == 'occupancy':
            # Visualize room occupancy percentages
            rooms = report_data.get('rooms_details', [])
            room_names = [room['room_name'] for room in rooms]
            occupancy_percentages = [room['occupancy_percentage'] for room in rooms]

            plt.bar(room_names, occupancy_percentages)
            plt.xlabel('Rooms')
            plt.ylabel('Occupancy Percentage')
            plt.ylim(0, 100)
            plt.xticks(rotation=45)

        elif report_type == 'revenue':
            # Visualize revenue per room
            rooms_revenue = report_data.get('rooms_revenue', [])
            room_names = [room['room_name'] for room in rooms_revenue]
            room_revenues = [room['room_revenue'] for room in rooms_revenue]

            plt.bar(room_names, room_revenues)
            plt.xlabel('Rooms')
            plt.ylabel('Revenue')
            plt.xticks(rotation=45)

        elif report_type == 'customer_retention':
            # Visualize customer session frequencies
            customer_details = report_data.get('customer_retention_details', [])
            session_counts = [customer['total_sessions'] for customer in customer_details]

            plt.hist(session_counts, bins='auto', edgecolor='black')
            plt.xlabel('Number of Sessions')
            plt.ylabel('Number of Customers')

        elif report_type == 'booking_trends':
            # Visualize historical booking trends
            trends = report_data.get('historical_trends', {})
            
            if 'monthly_booking_trend' in trends:
                monthly_data = trends['monthly_booking_trend']
                dates = list(monthly_data.keys())
                bookings = list(monthly_data.values())

                plt.plot(dates, bookings, marker='o')
                plt.xlabel('Month')
                plt.ylabel('Number of Bookings')
                plt.xticks(rotation=45)

        # Save the visualization
        output_file = f"{viz_dir}/{report_type}_{timestamp}.png"
        plt.tight_layout()
        plt.savefig(output_file)
        plt.close()

        return output_file

# Example usage in a route or script
def generate_comprehensive_studio_report(studio_id: int):
    """
    Generate a comprehensive report for a studio
    
    Args:
        studio_id (int): ID of the studio to generate report for
    
    Returns:
        Dict: Comprehensive report with different analytics
    """
    # Generate different types of reports
    occupancy_report = AdvancedReportGenerator.generate_occupancy_report(studio_id)
    revenue_report = AdvancedReportGenerator.generate_revenue_report(studio_id)
    retention_report = AdvancedReportGenerator.generate_customer_retention_report(studio_id)
    booking_trends = AdvancedReportGenerator.predict_booking_trends(studio_id)

    # Create comprehensive report
    comprehensive_report = {
        'studio_id': studio_id,
        'generated_at': datetime.utcnow().isoformat(),
        'occupancy': occupancy_report,
        'revenue': revenue_report,
        'customer_retention': retention_report,
        'booking_trends': booking_trends
    }

    # Optional: Generate visualizations
    try:
        occupancy_viz = AdvancedReportGenerator.visualize_report(occupancy_report, 'occupancy')
        revenue_viz = AdvancedReportGenerator.visualize_report(revenue_report, 'revenue')
        retention_viz = AdvancedReportGenerator.visualize_report(retention_report, 'customer_retention')
        trends_viz = AdvancedReportGenerator.visualize_report(booking_trends, 'booking_trends')

        comprehensive_report['visualizations'] = {
            'occupancy': occupancy_viz,
            'revenue': revenue_viz,
            'customer_retention': retention_viz,
            'booking_trends': trends_viz
        }
    except Exception as e:
        print(f"Error generating visualizations: {e}")
        comprehensive_report['visualizations'] = None

    return comprehensive_report

# Update admin routes to include new reporting functionality
def add_advanced_reporting_routes(admin_routes):
    """
    Add advanced reporting routes to the admin blueprint
    
    Args:
        admin_routes (Blueprint): Flask blueprint for admin routes
    """
    @admin_routes.route('/advanced_report/<int:studio_id>')
    def advanced_studio_report(studio_id):
        """
        Generate and return a comprehensive studio report
        """
        if 'admin_id' not in session:
            return redirect(url_for('admin_routes.admin_login'))
        
        try:
            # Generate comprehensive report
            comprehensive_report = generate_comprehensive_studio_report(studio_id)
            
            # Optional: Export report to different formats
            csv_export = AdvancedReportGenerator.export_report(comprehensive_report, 'csv', f'studio_{studio_id}_report')
            json_export = AdvancedReportGenerator.export_report(comprehensive_report, 'json', f'studio_{studio_id}_report')
            
            return render_template('advanced_report.html', 
                                   report=comprehensive_report, 
                                   csv_export=csv_export, 
                                   json_export=json_export)
        except Exception as e:
            return render_template('error.html', 
                                   error_message=f"Error generating report: {str(e)}")

    @admin_routes.route('/export_report/<int:studio_id>/<format>')
    def export_studio_report(studio_id, format):
        """
        Export studio report in specified format
        """
        if 'admin_id' not in session:
            return redirect(url_for('admin_routes.admin_login'))
        
        try:
            # Generate comprehensive report
            comprehensive_report = generate_comprehensive_studio_report(studio_id)
            
            # Export report
            export_file = AdvancedReportGenerator.export_report(comprehensive_report, format, f'studio_{studio_id}_report')
            
            # Send file for download
            return send_file(export_file, as_attachment=True)
        except Exception as e:
            return render_template('error.html', 
                                   error_message=f"Error exporting report: {str(e)}")

# Example of how to register the routes (in __init__.py or app configuration)
def register_advanced_reporting_routes(app):
    """
    Register advanced reporting routes
    """
    from app.routes.admin_routes import admin_routes
    add_advanced_reporting_routes(admin_routes)

# Readme documentation for the new feature
def advanced_reporting_readme():
    """
    Generate documentation for advanced reporting feature
    """
    readme_content = """
    # Advanced Reporting Feature

    ## Overview
    The Advanced Reporting feature provides comprehensive analytics for studio managers and administrators.

    ## Report Types
    1. **Occupancy Report**
       - Detailed room occupancy percentages
       - Total studio occupancy rate

    2. **Revenue Report**
       - Revenue breakdown per room
       - Total studio revenue

    3. **Customer Retention Report**
       - Customer session frequency
       - Average session intervals
       - Customer engagement metrics

    4. **Booking Trends**
       - Historical booking patterns
       - Predictive analytics for future bookings

    ## Visualization
    - Graphical representations of key metrics
    - Exportable charts for presentations

    ## Export Options
    - CSV export for spreadsheet analysis
    - JSON export for further data processing

    ## Usage
    Navigate to the studio's advanced report page to generate and view comprehensive analytics.
    """
    
    # Write readme to file
    with open('ADVANCED_REPORTING.md', 'w') as f:
        f.write(readme_content)

# Potential future enhancement: Scheduled report generation
def schedule_periodic_reports():
    """
    Example of how periodic reports could be scheduled
    Note: Requires additional task scheduling library like Celery
    """
    from celery import Celery
    from app.models.studio import Studio

    celery_app = Celery('studio_reports', broker='redis://localhost:6379')

    @celery_app.task
    def generate_monthly_studio_reports():
        """
        Generate monthly reports for all studios
        """
        studios = Studio.query.all()
        for studio in studios:
            try:
                report = generate_comprehensive_studio_report(studio.id)
                # Optional: email report to studio managers
                # send_report_email(studio.managers, report)
            except Exception as e:
                print(f"Error generating report for studio {studio.id}: {e}")

    # Schedule monthly report generation
    celery_app.conf.beat_schedule = {
        'generate-monthly-reports': {
            'task': 'schedule_periodic_reports.generate_monthly_studio_reports',
            'schedule': crontab(day_of_month=1, hour=0, minute=0)  # First day of each month
        }
    }