import { Users, Calendar, BarChart3, FileX } from 'lucide-react'

export function BookingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
        <p className="text-gray-600 mt-1">
          Manage room bookings and reservations.
        </p>
      </div>

      <div className="card">
        <div className="card-body text-center py-12">
          <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Bookings Management
          </h3>
          <p className="text-gray-600 mb-4">
            This feature will be implemented in the next phase of the React conversion.
            The booking calendar and management system will include:
          </p>
          <ul className="text-left text-gray-600 max-w-md mx-auto space-y-1">
            <li>• Calendar view of all bookings</li>
            <li>• Create new bookings</li>
            <li>• Edit and cancel existing bookings</li>
            <li>• Room availability management</li>
            <li>• Customer booking history</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export function StaffPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
        <p className="text-gray-600 mt-1">
          Manage staff members and session assignments.
        </p>
      </div>

      <div className="card">
        <div className="card-body text-center py-12">
          <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Staff Management
          </h3>
          <p className="text-gray-600 mb-4">
            This feature will be implemented in the next phase of the React conversion.
          </p>
        </div>
      </div>
    </div>
  )
}

export function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-gray-600 mt-1">
          Analytics and reporting for your studio performance.
        </p>
      </div>

      <div className="card">
        <div className="card-body text-center py-12">
          <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Reports & Analytics
          </h3>
          <p className="text-gray-600 mb-4">
            This feature will be implemented in the next phase of the React conversion.
          </p>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <FileX className="h-24 w-24 text-gray-400 mx-auto mb-4" />
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <h2 className="text-2xl font-medium text-gray-600 mt-4">Page Not Found</h2>
        <p className="text-gray-500 mt-2">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/dashboard"
          className="btn-primary inline-block mt-6"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}