import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'

export function Header() {
  const { user, logout } = useAuth()
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Link to="/dashboard" className="text-xl font-bold text-primary-600">
              Studio Manager
            </Link>
            {user?.role === 'Admin' && (
              <span className="ml-3 px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                Admin
              </span>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 text-gray-700 hover:text-gray-900"
              >
                <User className="h-5 w-5" />
                <span>{user?.name}</span>
                <ChevronDown className="h-4 w-4" />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50 border border-gray-200">
                  <div className="py-1">
                    <div className="px-4 py-2 text-sm text-gray-600 border-b border-gray-100">
                      <div className="font-medium">{user?.name}</div>
                      <div className="text-xs">{user?.email}</div>
                      <div className="text-xs text-primary-600">{user?.role}</div>
                    </div>
                    <Link
                      to="/settings"
                      className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
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
    </header>
  )
}