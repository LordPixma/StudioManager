import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuthHook'
import { cn } from '../lib/utils'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/useToast'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, isAuthenticated, isLoading } = useAuth()
  const { notify } = useToast()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    remember_me: false,
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    try {
      await login(formData)
  notify({ kind: 'success', title: 'Welcome back', message: 'Signed in successfully.' })
  navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Login failed. Please try again.')
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  return (
    <div className="min-h-screen grid md:grid-cols-2 bg-gray-50">
      {/* Left: Branding */}
      <div className="relative hidden md:flex flex-col p-10 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden">
        <div className="pointer-events-none absolute inset-0 gradient-mesh opacity-70" />
        {/* Top brand */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-primary-500 to-primary-600 flex items-center justify-center text-white font-bold">SM</div>
          <div className="text-xl font-bold">Studio Manager</div>
        </div>
        {/* Centered hero content */}
        <div className="flex-1 flex items-center">
          <div className="max-w-md">
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">Manage bookings, staff, and customers seamlessly.</h2>
            <p className="mt-5 text-base md:text-lg text-gray-300/90 leading-relaxed">A fast, modern platform for multi-room studios. Secure, cloud-native, and built for teams.</p>
          </div>
        </div>
        {/* Footer */}
        <div className="text-sm text-gray-400">© {new Date().getFullYear()} Studio Manager</div>
      </div>

      {/* Right: Form */}
      <div className="flex items-center justify-center px-6 py-12 md:px-12 bg-white">
        <div className="w-full max-w-md animate-fade-slide-up">
          <div className="mb-8 md:hidden text-center">
            <div className="text-2xl font-bold text-gray-900">Studio Manager</div>
            <div className="text-gray-600">Sign in to your account</div>
          </div>
          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="form-label">Email address</label>
              <Input id="email" name="email" type="email" required placeholder="Enter your email" value={formData.email} onChange={handleChange} />
            </div>
            <div>
              <label htmlFor="password" className="form-label">Password</label>
              <Input id="password" name="password" type="password" required placeholder="Enter your password" value={formData.password} onChange={handleChange} />
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input id="remember_me" name="remember_me" type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" checked={formData.remember_me} onChange={handleChange} />
                Remember me
              </label>
              <a href="#" className="text-sm text-primary-600 hover:text-primary-500">Forgot password?</a>
            </div>
            <Button type="submit" disabled={isLoading} className={cn('w-full h-12 text-base', isLoading && 'opacity-50 cursor-not-allowed')}>
              {isLoading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            Don’t have an account?{' '}
            <Link to="/register" className="text-primary-600 hover:text-primary-500 font-medium">Sign up</Link>
          </div>
        </div>
      </div>
    </div>
  )
}