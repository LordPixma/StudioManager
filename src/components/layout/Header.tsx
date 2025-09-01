import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, User, Settings, ChevronDown, Moon, Sun, Menu } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { Link as RouterLink } from 'react-router-dom'
import { navigation, adminNavigation } from './Sidebar'
import { useTenantSettings } from '../../hooks/useTenantSettings'

export function Header() {
  const { user, logout } = useAuth()
  const { tenant, settings } = useTenantSettings()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const [isDark, setIsDark] = useState(false)

  useEffect(() => {
    if (isDark) document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [isDark])

  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl shadow-sm border-b border-gray-200 dark:border-gray-800">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {/* Mobile menu button */}
            <button className="mr-3 md:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/dashboard" className="flex items-center gap-2">
              {settings?.branding_logo_url ? (
                <img src={settings.branding_logo_url} alt="Logo" className="h-7 w-7 rounded" />
              ) : (
                <span className="text-xl font-bold text-primary-600">Studio Manager</span>
              )}
              <span className="text-xl font-bold text-primary-600 hidden sm:block">{tenant?.name || 'Studio Manager'}</span>
            </Link>
            {user?.role === 'Admin' && (
              <span className="ml-3 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                Admin
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDark(!isDark)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Toggle theme"
              title="Toggle theme"
            >
              {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
              >
                <User className="h-5 w-5" />
                <span>{user?.name}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-900 rounded-md shadow-lg z-50 border border-gray-200 dark:border-gray-800">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-600 dark:text-gray-300 border-b border-gray-100 dark:border-gray-800">
                      <div className="font-medium">{user?.name}</div>
                      <div className="text-xs">{user?.email}</div>
                      <div className="text-xs text-primary-600">{user?.role}</div>
                    </div>
                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      onClick={() => setIsDropdownOpen(false)}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Settings
                    </Link>
                    <button
                      onClick={() => {
                        setIsDropdownOpen(false)
                        logout()
                      }}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-white dark:bg-gray-900 shadow-xl p-4">
            <div className="mb-4 text-xs font-semibold text-gray-500 px-2">Navigation</div>
            <nav className="flex flex-col gap-1">
              {[...navigation, ...adminNavigation].map((item) => {
                const Icon = item.icon
                return (
                  <RouterLink key={item.name} to={item.href} onClick={() => setMobileOpen(false)} className="flex items-center px-3 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <Icon className="h-5 w-5 mr-3" />
                    {item.name}
                  </RouterLink>
                )
              })}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}