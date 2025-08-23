import { useAuth } from '../hooks/useAuth'
import { BarChart3, Users, Calendar, DollarSign } from 'lucide-react'

// Mock data for demonstration
const stats = [
  { name: 'Total Customers', value: '1,234', change: '+12%', icon: Users, color: 'text-blue-600' },
  { name: 'Active Bookings', value: '89', change: '+5%', icon: Calendar, color: 'text-green-600' },
  { name: 'Monthly Revenue', value: '$12,345', change: '+18%', icon: DollarSign, color: 'text-yellow-600' },
  { name: 'Utilization Rate', value: '78%', change: '+3%', icon: BarChart3, color: 'text-purple-600' },
]

const recentBookings = [
  { id: 1, customer: 'John Doe', room: 'Studio A', date: '2024-01-20', time: '10:00 AM', status: 'confirmed' },
  { id: 2, customer: 'Jane Smith', room: 'Studio B', date: '2024-01-20', time: '2:00 PM', status: 'pending' },
  { id: 3, customer: 'Mike Johnson', room: 'Studio A', date: '2024-01-21', time: '9:00 AM', status: 'confirmed' },
]

export function DashboardPage() {
  const { user } = useAuth()

  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back, {user?.name}!
        </h1>
        <p className="text-gray-600 mt-1">
          Here's what's happening with your studio today.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div key={stat.name} className="card">
              <div className="card-body">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Icon className={`h-8 w-8 ${stat.color}`} />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        {stat.name}
                      </dt>
                      <dd className="flex items-baseline">
                        <div className="text-2xl font-semibold text-gray-900">
                          {stat.value}
                        </div>
                        <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                          {stat.change}
                        </div>
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Recent bookings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-lg font-medium text-gray-900">Recent Bookings</h3>
        </div>
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Room
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date & Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentBookings.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {booking.customer}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {booking.room}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {booking.date} at {booking.time}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        booking.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {booking.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card">
          <div className="card-body text-center">
            <Users className="h-12 w-12 text-blue-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Add Customer</h3>
            <p className="text-gray-600 mb-4">Register a new customer to your studio</p>
            <button className="btn-primary">Add Customer</button>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <Calendar className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">New Booking</h3>
            <p className="text-gray-600 mb-4">Schedule a new room booking</p>
            <button className="btn-primary">Create Booking</button>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <BarChart3 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">View Reports</h3>
            <p className="text-gray-600 mb-4">Analyze your studio performance</p>
            <button className="btn-primary">Open Reports</button>
          </div>
        </div>
      </div>
    </div>
  )
}