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
}
