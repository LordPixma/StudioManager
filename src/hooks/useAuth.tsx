import { createContext, useContext, useEffect, ReactNode } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../store/authStore'
import { authAPI } from '../lib/api'
import type { User, LoginCredentials, RegisterData } from '../types'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  checkSession: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const { user, token, isLoading, setAuth, clearAuth, setLoading, updateSessionTimeout } = useAuthStore()

  // Check if user has valid session on mount
  const { refetch: checkSession } = useQuery({
    queryKey: ['session'],
    queryFn: async () => {
      const response = await authAPI.getSession()
      if (response.success && response.data?.user) {
        setAuth(response.data.user, token || '')
        if (response.data.session_timeout) {
          updateSessionTimeout(response.data.session_timeout)
        }
        return response.data.user
      } else {
        clearAuth()
        return null
      }
    },
    enabled: !!token && !user, // Only check if we have token but no user
    retry: false,
  })

  // Login mutation
  const loginMutation = useMutation({
    mutationFn: authAPI.login,
    onSuccess: (response) => {
      if (response.success && response.data?.user) {
        const authToken = response.data.token || token || 'session'
        setAuth(response.data.user, authToken)
        if (response.data.session_timeout) {
          updateSessionTimeout(response.data.session_timeout)
        }
        queryClient.invalidateQueries({ queryKey: ['session'] })
      } else {
        throw new Error(response.message || 'Login failed')
      }
    },
    onError: (error: any) => {
      console.error('Login error:', error)
      throw error
    },
  })

  // Register mutation
  const registerMutation = useMutation({
    mutationFn: authAPI.register,
    onSuccess: (response) => {
      if (response.success && response.data?.user) {
        const authToken = response.data.token || 'session'
        setAuth(response.data.user, authToken)
        queryClient.invalidateQueries({ queryKey: ['session'] })
      } else {
        throw new Error(response.message || 'Registration failed')
      }
    },
    onError: (error: any) => {
      console.error('Registration error:', error)
      throw error
    },
  })

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: authAPI.logout,
    onSuccess: () => {
      clearAuth()
      queryClient.clear()
      window.location.href = '/login'
    },
  })

  useEffect(() => {
    // Initialize token from localStorage if needed
    const storedToken = localStorage.getItem('auth_token')
    if (storedToken && !token) {
      setAuth(user || ({} as User), storedToken)
    }
  }, [])

  const contextValue: AuthContextType = {
    user,
    isLoading: isLoading || loginMutation.isPending || registerMutation.isPending,
    isAuthenticated: !!user && !!token,
    
    login: async (credentials: LoginCredentials) => {
      setLoading(true)
      try {
        await loginMutation.mutateAsync(credentials)
      } finally {
        setLoading(false)
      }
    },
    
    register: async (data: RegisterData) => {
      setLoading(true)
      try {
        await registerMutation.mutateAsync(data)
      } finally {
        setLoading(false)
      }
    },
    
    logout: () => {
      logoutMutation.mutate()
    },
    
    checkSession: async () => {
      await checkSession()
    },
  }

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  )
}