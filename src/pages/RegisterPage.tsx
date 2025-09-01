import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'
import { useToast } from '../components/ui/Toast'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, isAuthenticated, isLoading } = useAuth()
  const { notify } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    tenant_name: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required'
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid'
    }

    if (!formData.password) {
      newErrors.password = 'Password is required'
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters'
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match'
    }

    if (!formData.tenant_name.trim()) {
      newErrors.tenant_name = 'Studio/Company name is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return

    try {
      await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        tenant_name: formData.tenant_name,
      })
      notify({ kind: 'success', title: 'Account created', message: 'Welcome! Your account is ready.' })
      navigate('/dashboard')
    } catch (err: any) {
      const backendErrors = err.response?.data?.errors
      if (backendErrors && typeof backendErrors === 'object') {
        // Map array-shaped errors to first string, keep strings as-is
        const mapped: Record<string, string> = {}
        for (const key of Object.keys(backendErrors)) {
          const val = backendErrors[key]
          mapped[key] = Array.isArray(val) ? String(val[0]) : String(val)
        }
        setErrors(mapped)
      } else {
        setErrors({ general: err.message || 'Registration failed. Please try again.' })
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }))
    }
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
            <h2 className="text-4xl md:text-5xl font-semibold tracking-tight leading-tight">Create your account and start today.</h2>
            <p className="mt-5 text-base md:text-lg text-gray-300/90 leading-relaxed">Set up your studio in minutes. Flexible, secure, and ready to scale with your business.</p>
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
            <div className="text-gray-600">Create your account</div>
          </div>
          {errors.general && (
            <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {errors.general}
            </div>
          )}
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="tenant_name" className="form-label">Studio/Company Name *</label>
              <Input id="tenant_name" name="tenant_name" type="text" required placeholder="Enter your studio name" value={formData.tenant_name} onChange={handleChange} />
              {errors.tenant_name && (<p className="form-error">{errors.tenant_name}</p>)}
            </div>
            <div>
              <label htmlFor="name" className="form-label">Your Full Name *</label>
              <Input id="name" name="name" type="text" required placeholder="Enter your full name" value={formData.name} onChange={handleChange} />
              {errors.name && (<p className="form-error">{errors.name}</p>)}
            </div>
            <div>
              <label htmlFor="email" className="form-label">Email Address *</label>
              <Input id="email" name="email" type="email" required placeholder="Enter your email" value={formData.email} onChange={handleChange} />
              {errors.email && (<p className="form-error">{errors.email}</p>)}
            </div>
            <div>
              <label htmlFor="password" className="form-label">Password *</label>
              <Input id="password" name="password" type="password" required placeholder="Create a password (min 8 characters)" value={formData.password} onChange={handleChange} />
              {errors.password && (<p className="form-error">{errors.password}</p>)}
            </div>
            <div>
              <label htmlFor="confirmPassword" className="form-label">Confirm Password *</label>
              <Input id="confirmPassword" name="confirmPassword" type="password" required placeholder="Confirm your password" value={formData.confirmPassword} onChange={handleChange} />
              {errors.confirmPassword && (<p className="form-error">{errors.confirmPassword}</p>)}
            </div>
            <Button type="submit" disabled={isLoading} className={cn('w-full h-12 text-base', isLoading && 'opacity-50 cursor-not-allowed')}>
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  )
}