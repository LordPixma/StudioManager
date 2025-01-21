from app import create_app, db
from app.models.manager import StudioManager
from tabulate import tabulate

def generate_user_report():
    """
    Generate a detailed report of all admin and studio managers in the system.
    Admins are identified as StudioManager entries with no associated studio_id.
    """
    # Initialize the Flask app and database context
    app = create_app("DevelopmentConfig")
    
    with app.app_context():
        # Get all users
        all_users = StudioManager.query.all()
        
        # Separate admins and managers
        admins = []
        managers = []
        
        for user in all_users:
            user_data = {
                'ID': user.id,
                'Name': user.name,
                'Email': user.email
            }
            
            # If studio_id is None, this is an admin
            if user.studio_id is None:
                admins.append(user_data)
            else:
                # Get studio details for managers
                studio = user.studio
                user_data['Studio'] = studio.name if studio else 'N/A'
                user_data['Studio Address'] = studio.address if studio else 'N/A'
                managers.append(user_data)
        
        # Print the reports
        print("\n=== System Administrators ===")
        if admins:
            print(tabulate(admins, headers='keys', tablefmt='grid'))
        else:
            print("No administrators found.")
            
        print("\n=== Studio Managers ===")
        if managers:
            print(tabulate(managers, headers='keys', tablefmt='grid'))
        else:
            print("No studio managers found.")
        
        # Print summary
        print("\nSummary:")
        print(f"Total Administrators: {len(admins)}")
        print(f"Total Studio Managers: {len(managers)}")
        print(f"Total Users: {len(admins) + len(managers)}")

def export_to_csv(filename='user_report.csv'):
    """
    Export the user report to a CSV file.
    
    Args:
        filename (str): Name of the output CSV file
    """
    import csv
    
    app = create_app("DevelopmentConfig")
    
    with app.app_context():
        all_users = StudioManager.query.all()
        
        with open(filename, 'w', newline='') as csvfile:
            fieldnames = ['ID', 'Type', 'Name', 'Email', 'Studio', 'Studio Address']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
            
            writer.writeheader()
            for user in all_users:
                user_data = {
                    'ID': user.id,
                    'Type': 'Administrator' if user.studio_id is None else 'Studio Manager',
                    'Name': user.name,
                    'Email': user.email,
                    'Studio': user.studio.name if user.studio else 'N/A',
                    'Studio Address': user.studio.address if user.studio else 'N/A'
                }
                writer.writerow(user_data)
        
        print(f"\nReport exported to {filename}")

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Generate user report')
    parser.add_argument('--export', action='store_true', help='Export report to CSV')
    parser.add_argument('--filename', default='user_report.csv', help='CSV filename for export')
    
    args = parser.parse_args()
    
    # Generate the console report
    generate_user_report()
    
    # Export to CSV if requested
    if args.export:
        export_to_csv(args.filename)