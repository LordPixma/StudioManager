// User and authentication types
export interface User {
  id: number
  name: string
  email: string
  role: 'Admin' | 'Studio Manager' | 'Staff/Instructor' | 'Receptionist'
  permissions: string[]
  studio_id?: number
  tenant_id?: number // Added for multi-tenancy
}

export interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  sessionTimeout?: string
}

export interface LoginCredentials {
  email: string
  password: string
  remember_me?: boolean
}

export interface RegisterData {
  name: string
  email: string
  password: string
  tenant_name?: string // For SaaS registration
}

// Studio and tenant types
export interface Studio {
  id: number
  name: string
  tenant_id: number
  address?: string
  phone?: string
  email?: string
  settings?: Record<string, any>
}

export interface Tenant {
  id: number
  name: string
  subdomain: string
  plan: 'free' | 'basic' | 'premium' | 'enterprise'
  is_active: boolean
  created_at: string
  settings?: Record<string, any>
}

// Customer types
export interface Customer {
  id: number
  studio_id: number
  tenant_id: number
  name: string
  email: string
  phone?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface CustomerFormData {
  name: string
  email: string
  phone?: string
  notes?: string
}

// Booking and room types
export interface Room {
  id: number
  studio_id: number
  tenant_id: number
  name: string
  capacity: number
  hourly_rate?: number
  equipment?: string[]
  is_active: boolean
}

export interface Booking {
  id: number
  room_id: number
  customer_id: number
  tenant_id: number
  start_time: string
  end_time: string
  status: 'confirmed' | 'pending' | 'cancelled'
  notes?: string
  total_amount?: number
}

// Staff types
export interface Staff {
  id: number
  user_id: number
  studio_id: number
  tenant_id: number
  specialties: string[]
  hourly_rate?: number
  bio?: string
  is_active: boolean
}

export interface Session {
  id: number
  staff_id: number
  room_id: number
  tenant_id: number
  title: string
  description?: string
  start_time: string
  end_time: string
  max_participants: number
  price: number
  status: 'scheduled' | 'completed' | 'cancelled'
}

// API response types
export interface ApiResponse<T = any> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

export interface PaginatedResponse<T> {
  success: boolean
  data: {
    items: T[]
    total: number
    page: number
    per_page: number
    pages: number
  }
}

// Form and UI types
export interface FormError {
  field: string
  message: string
}

export interface TableColumn<T> {
  key: keyof T
  title: string
  sortable?: boolean
  render?: (value: any, item: T) => React.ReactNode
}

export interface FilterOptions {
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
  page?: number
  per_page?: number
  [key: string]: any
}