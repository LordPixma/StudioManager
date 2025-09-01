import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { cn } from '../lib/utils'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function RegisterPage() {
  const navigate = useNavigate()
  const { register, isAuthenticated, isLoading } = useAuth()
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
      navigate('/dashboard')
    } catch (err: any) {
      if (err.response?.data?.errors) {
        setErrors(err.response.data.errors)
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
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-gray-900 mb-2">
            Studio Manager
          </h1>
          <h2 className="text-center text-xl text-gray-600">
            Create your account
          </h2>
          <p className="text-center text-sm text-gray-500 mt-2">
            Start managing your studio today
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {errors.general && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {errors.general}
            </div>
          )}
          
          <div className="space-y-4">
            <div>
              <label htmlFor="tenant_name" className="form-label">
                Studio/Company Name *
              </label>
              <Input
                id="tenant_name"
                name="tenant_name"
                type="text"
                required
                placeholder="Enter your studio name"
                value={formData.tenant_name}
                onChange={handleChange}
              />
              {errors.tenant_name && (
                <p className="form-error">{errors.tenant_name}</p>
              )}
            </div>

            <div>
              <label htmlFor="name" className="form-label">
                Your Full Name *
              </label>
              <Input
                id="name"
                name="name"
                type="text"
                required
                placeholder="Enter your full name"
                value={formData.name}
                onChange={handleChange}
              />
              {errors.name && (
                <p className="form-error">{errors.name}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="email" className="form-label">
                Email Address *
              </label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="Enter your email"
                value={formData.email}
                onChange={handleChange}
              />
              {errors.email && (
                <p className="form-error">{errors.email}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="password" className="form-label">
                Password *
              </label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="Create a password (min 8 characters)"
                value={formData.password}
                onChange={handleChange}
              />
              {errors.password && (
                <p className="form-error">{errors.password}</p>
              )}
            </div>
            
            <div>
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password *
              </label>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChange={handleChange}
              />
              {errors.confirmPassword && (
                <p className="form-error">{errors.confirmPassword}</p>
              )}
            </div>
          </div>

          <div>
            <Button
              type="submit"
              disabled={isLoading}
              className={cn('w-full', isLoading && 'opacity-50 cursor-not-allowed')}
            >
              {isLoading ? 'Creating account...' : 'Create account'}
            </Button>
          </div>
          
          <div className="text-center">
            <span className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium">
                Sign in
              </Link>
            </span>
          </div>
        </form>
      </div>
    </div>
  )
}