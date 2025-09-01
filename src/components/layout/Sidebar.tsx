import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  UserCheck, 
  BarChart3,
  Building2,
  Settings 
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { cn } from '../../lib/utils'

export const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users, permission: 'view_customers' },
  { name: 'Bookings', href: '/bookings', icon: Calendar, permission: 'view_bookings' },
  { name: 'Rooms', href: '/rooms', icon: Building2, permission: 'view_bookings' },
  { name: 'Staff', href: '/staff', icon: UserCheck, permission: 'view_staff' },
  { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'view_reports' },
]

export const adminNavigation = [
  { name: 'Studios', href: '/studios', icon: Building2, role: 'Admin' },
  { name: 'Settings', href: '/settings', icon: Settings },
]

export function Sidebar() {
  const { user } = useAuth()

  const canAccess = (item: any) => {
    if (item.role && user?.role !== item.role) return false
    if (item.permission && !user?.permissions.includes(item.permission)) return false
    return true
  }

  return (
    <aside className="w-72 bg-white/80 backdrop-blur-xl border-r border-gray-200/50 shadow-lg min-h-[calc(100vh-73px)]">
      <div className="sticky top-0 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-10 h-10 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Studio Manager</h1>
            <p className="text-xs text-gray-500">SaaS Platform</p>
          </div>
        </div>
      </div>
      <nav className="px-4 pb-6 space-y-1">
        {navigation.map((item) => {
          if (!canAccess(item)) return null
          
          const Icon = item.icon
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                )
              }
            >
              <Icon className="h-5 w-5 mr-3" />
              {item.name}
            </NavLink>
          )
        })}

        <div className="pt-4 mt-4 border-t border-gray-200">
          {adminNavigation.map((item) => {
            if (!canAccess(item)) return null
            
            const Icon = item.icon
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  )
                }
              >
                <Icon className="h-5 w-5 mr-3" />
                {item.name}
              </NavLink>
            )
          })}
        </div>
      </nav>
    </aside>
  )
}