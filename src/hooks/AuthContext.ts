import { createContext } from 'react'
import type { User, LoginCredentials, RegisterData } from '../types'

export interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginCredentials) => Promise<void>
  register: (data: RegisterData) => Promise<void>
  logout: () => void
  checkSession: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)
