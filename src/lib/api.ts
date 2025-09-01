import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL || '/api'

export const http = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response shape from backend
export type ApiResponse<T = any> = {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  meta?: any
}

export const authAPI = {
  async login(payload: { email: string; password: string; remember_me?: boolean }) {
    const { data } = await http.post<ApiResponse>(`/login`, payload)
    return data
  },
  async register(payload: { name: string; email: string; password: string; tenant_name?: string; tenant_id?: number }) {
    const { data } = await http.post<ApiResponse>(`/register`, payload)
    return data
  },
  async logout() {
    const { data } = await http.post<ApiResponse>(`/logout`)
    return data
  },
  async getSession() {
    const { data } = await http.get<ApiResponse>(`/session`)
    return data
  },
}

export const customerAPI = {
  async getAll(params: { search?: string; page?: number; per_page?: number }) {
    const { data } = await http.get<ApiResponse>(`/customers`, { params })
    // Normalize to items/total/pages for current UI
    if (data.success && Array.isArray((data as any).data)) {
      const meta = (data as any).meta || { total_count: (data as any).data.length, page: 1, per_page: (params.per_page || (data as any).data.length) }
      return { success: true, data: { items: (data as any).data, total: meta.total_count, pages: Math.ceil(meta.total_count / meta.per_page) }, meta }
    }
    return data
  },
  async getById(id: number) {
    const { data } = await http.get<ApiResponse>(`/customers/${id}`)
    return data
  },
  async create(payload: { name: string; email: string; phone?: string; notes?: string; studio_id?: number }) {
    const { data } = await http.post<ApiResponse>(`/customers`, payload)
    return data
  },
  async update(id: number, payload: Partial<{ name: string; email: string; phone: string; notes: string }>) {
    const { data } = await http.put<ApiResponse>(`/customers/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await http.delete<ApiResponse>(`/customers/${id}`)
    return data
  },
}

export const tenantsAPI = {
  async create(payload: { tenant_name: string; subdomain?: string; admin_name: string; admin_email: string; admin_password: string; plan?: string }) {
    const { data } = await http.post<ApiResponse>(`/tenants`, payload)
    return data
  },
  async list() {
    const { data } = await http.get<ApiResponse>(`/tenants`)
    return data
  },
  async get(id: number) {
  const { data } = await http.get<ApiResponse>(`/tenants/${id}`)
  return data
  },
  async update(id: number, payload: Partial<{ name: string; plan: string; is_active: boolean; settings: Record<string, any> }>) {
    const { data } = await http.put<ApiResponse>(`/tenants/${id}`, payload)
    return data
  },
}

export const roomsAPI = {
  async list(params?: { studio_id?: number }) {
    const { data } = await http.get<ApiResponse>(`/rooms`, { params })
    return data
  },
  async create(payload: { name: string; studio_id?: number; capacity?: number; hourly_rate?: number; equipment?: any[] }) {
    const { data } = await http.post<ApiResponse>(`/rooms`, payload)
    return data
  },
  async update(id: number, payload: Partial<{ name: string; capacity: number; hourly_rate: number; is_active: boolean; equipment: any[] }>) {
    const { data } = await http.put<ApiResponse>(`/rooms/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await http.delete<ApiResponse>(`/rooms/${id}`)
    return data
  },
}

export const bookingsAPI = {
  async list(params?: { room_id?: number; studio_id?: number; from?: string; to?: string }) {
    const { data } = await http.get<ApiResponse>(`/bookings`, { params })
    return data
  },
  async create(payload: { room_id: number; customer_id: number; start_time: string; end_time: string; status?: 'confirmed' | 'cancelled'; notes?: string; total_amount?: number }) {
    const { data } = await http.post<ApiResponse>(`/bookings`, payload)
    return data
  },
  async update(id: number, payload: Partial<{ start_time: string; end_time: string; status: 'confirmed' | 'cancelled'; notes: string; total_amount: number }>) {
    const { data } = await http.put<ApiResponse>(`/bookings/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await http.delete<ApiResponse>(`/bookings/${id}`)
    return data
  },
}

export const staffAPI = {
  async list() {
    const { data } = await http.get<ApiResponse>(`/staff`)
    return data
  },
  async create(payload: { name: string; email: string; password?: string; role?: string; studio_id?: number; permissions?: string[] }) {
    const { data } = await http.post<ApiResponse>(`/staff`, payload)
    return data
  },
  async update(id: number, payload: Partial<{ name: string; email: string; role: string; studio_id: number; is_active: boolean; permissions: string[] }>) {
    const { data } = await http.put<ApiResponse>(`/staff/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await http.delete<ApiResponse>(`/staff/${id}`)
    return data
  },
}

export const reportsAPI = {
  async downloadBookingsCsv(): Promise<Blob> {
    const resp = await http.get(`/reports/bookings.csv`, { responseType: 'blob' })
    return resp.data
  },
  async downloadRevenueCsv(): Promise<Blob> {
    const resp = await http.get(`/reports/revenue.csv`, { responseType: 'blob' })
    return resp.data
  },
}
