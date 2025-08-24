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

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Customers', href: '/customers', icon: Users, permission: 'view_customers' },
  { name: 'Bookings', href: '/bookings', icon: Calendar, permission: 'view_bookings' },
  { name: 'Staff', href: '/staff', icon: UserCheck, permission: 'view_staff' },
  { name: 'Reports', href: '/reports', icon: BarChart3, permission: 'view_reports' },
]

const adminNavigation = [
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
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-[calc(100vh-73px)]">
      <nav className="p-4 space-y-1">
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