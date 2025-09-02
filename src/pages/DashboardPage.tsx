import { useAuth } from '../hooks/useAuthHook'
import { useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { announcementsAPI, analyticsAPI, bookingsAPI, customerAPI, roomsAPI } from '../lib/api'
import type { Announcement, Booking, Customer, Room } from '../types'
import { BarChart3, Users, Calendar, DollarSign } from 'lucide-react'
import { Button } from '../components/ui/Button'
import { useNavigate } from 'react-router-dom'

type StatCard = { name: string; value: string; change?: string; icon: ElementType; color: string }

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [monthRevenue, setMonthRevenue] = useState<number>(0)
  const [totalCustomers, setTotalCustomers] = useState<number>(0)
  const [activeBookings, setActiveBookings] = useState<number>(0)
  const [utilRate, setUtilRate] = useState<number>(0)
  const [recent, setRecent] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const monthRange = useMemo(() => {
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)
    return { from: start.toISOString(), to: end.toISOString() }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
  try {
        // announcements
        const ann = await announcementsAPI.list({ limit: 5 })
        if (mounted && ann.success) setAnnouncements(Array.isArray(ann.data) ? (ann.data as Announcement[]) : [])

        // rooms and a small customer slice to map names in recent bookings
        const [rRes, cRes] = await Promise.all([
          roomsAPI.list(),
          customerAPI.getAll({ per_page: 100 }),
        ])
        if (mounted) {
          if (rRes.success) setRooms(Array.isArray(rRes.data) ? (rRes.data as Room[]) : [])
          if (cRes.success) {
            const raw = cRes.data as unknown
            if (Array.isArray(raw)) setCustomers(raw as Customer[])
            else {
              const items = (raw as { items?: unknown })?.items
              setCustomers(Array.isArray(items) ? (items as Customer[]) : [])
              const totalFromMeta = (cRes.meta as { total_count?: number } | undefined)?.total_count
              if (typeof totalFromMeta === 'number') setTotalCustomers(totalFromMeta)
            }
          }
        }

        // KPI summary for this month (revenue + utilization)
        const sum = await analyticsAPI.summary({ from: monthRange.from, to: monthRange.to, open_hours_per_day: 12 })
        if (mounted && sum.success) {
          const data = sum.data as { revenue?: number; occupancy_rate?: number; unique_customers?: number }
          setMonthRevenue(Number(data?.revenue || 0))
          setUtilRate(Number(data?.occupancy_rate || 0))
          if (typeof data?.unique_customers === 'number' && data.unique_customers > 0) {
            setTotalCustomers(data.unique_customers)
          }
        }

        // Bookings for this month (count + recent list)
        const bRes = await bookingsAPI.list({ from: monthRange.from, to: monthRange.to })
        if (mounted && bRes.success) {
          const list = Array.isArray(bRes.data) ? (bRes.data as Booking[]) : []
          // active = confirmed in this month
          setActiveBookings(list.filter(b => b.status === 'confirmed').length)
          // recent = latest 5 by start_time desc
          const recentSorted = [...list].sort((a, b) => (new Date(b.start_time).getTime() - new Date(a.start_time).getTime())).slice(0, 5)
          setRecent(recentSorted)
        }
  } finally {
      }
    })()
    return () => { mounted = false }
  }, [])

  const stats: StatCard[] = [
    { name: 'Total Customers', value: totalCustomers.toLocaleString(), change: undefined, icon: Users, color: 'text-blue-600' },
    { name: 'Active Bookings', value: activeBookings.toLocaleString(), change: undefined, icon: Calendar, color: 'text-green-600' },
    { name: 'Monthly Revenue', value: `$${monthRevenue.toFixed(2)}`, change: undefined, icon: DollarSign, color: 'text-yellow-600' },
    { name: 'Utilization Rate', value: `${Math.round(utilRate * 100)}%`, change: undefined, icon: BarChart3, color: 'text-purple-600' },
  ]

  return (
    <div className="space-y-8">
      {/* Announcements */}
      {announcements.length > 0 && (
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Announcements</h3></div>
          <div className="card-body space-y-3">
            {announcements.map(a => (
              <div key={a.id} className="p-3 rounded border border-gray-200 dark:border-gray-800">
                <div className="font-medium">{a.title}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{a.body}</div>
                <div className="text-xs text-gray-500">{new Date(a.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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
    <div key={stat.name} className="card transition-transform duration-300 hover:-translate-y-1 hover:shadow-md">
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
                        {stat.change ? (
                          <div className="ml-2 flex items-baseline text-sm font-semibold text-green-600">
                            {stat.change}
                          </div>
                        ) : null}
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
                {recent.map((booking) => (
                  <tr key={booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {(() => {
                        const c = customers.find(c => c.id === booking.customer_id)
                        return c?.name || `Customer #${booking.customer_id}`
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {(() => {
                        const r = rooms.find(r => r.id === booking.room_id)
                        return r?.name || `Room #${booking.room_id}`
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(booking.start_time).toLocaleDateString()} at {new Date(booking.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        booking.status === 'confirmed'
                          ? 'bg-green-100 text-green-800'
                          : booking.status === 'cancelled'
                          ? 'bg-red-100 text-red-800'
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
            <Button onClick={() => navigate('/customers')}>Add Customer</Button>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <Calendar className="h-12 w-12 text-green-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">New Booking</h3>
            <p className="text-gray-600 mb-4">Schedule a new room booking</p>
            <Button onClick={() => navigate('/bookings')}>Create Booking</Button>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <BarChart3 className="h-12 w-12 text-purple-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">View Reports</h3>
            <p className="text-gray-600 mb-4">Analyze your studio performance</p>
            <Button onClick={() => navigate('/reports')}>Open Reports</Button>
          </div>
        </div>
      </div>
    </div>
  )
}