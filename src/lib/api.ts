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
export type ApiResponse<T = unknown> = {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
  meta?: Record<string, unknown>
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

export const userAPI = {
  async me() {
    const { data } = await http.get<ApiResponse>(`/users/me`)
    return data
  },
  async updateMe(payload: Partial<{ name: string; phone: string; bio: string; avatar_url: string; timezone: string }>) {
    const { data } = await http.put<ApiResponse>(`/users/me`, payload)
    return data
  },
  async uploadAvatar(file: File) {
    const form = new FormData()
    form.append('file', file)
    const resp = await http.post<ApiResponse<{ url: string }>>(`/users/me/avatar`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return resp.data
  }
}

export const customerAPI = {
  async getAll(params: { search?: string; page?: number; per_page?: number }) {
    const { data } = await http.get<ApiResponse>(`/customers`, { params })
    // Normalize to items/total/pages for current UI
    if (data.success && Array.isArray(data.data)) {
      const meta = (data.meta as { total_count?: number; page?: number; per_page?: number } | undefined) ?? {
        total_count: data.data.length,
        page: 1,
        per_page: params.per_page ?? data.data.length,
      }
      const total = meta.total_count ?? data.data.length
      const perPage = meta.per_page ?? data.data.length
      return { success: true, data: { items: data.data, total, pages: Math.ceil(total / perPage) }, meta }
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
  async update(id: number, payload: Partial<{ name: string; plan: string; is_active: boolean; settings: Record<string, unknown> }>) {
    const { data } = await http.put<ApiResponse>(`/tenants/${id}`, payload)
    return data
  },
}

export const roomsAPI = {
  async list(params?: { studio_id?: number }) {
    const { data } = await http.get<ApiResponse>(`/rooms`, { params })
    return data
  },
  async create(payload: { name: string; studio_id?: number; capacity?: number; hourly_rate?: number; equipment?: string[] }) {
    const { data } = await http.post<ApiResponse>(`/rooms`, payload)
    return data
  },
  async update(id: number, payload: Partial<{ name: string; capacity: number; hourly_rate: number; is_active: boolean; equipment: string[] }>) {
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
  async create(payload: { room_id: number; customer_id: number; start_time: string; end_time: string; status?: 'confirmed' | 'cancelled'; notes?: string; total_amount?: number; staff_id?: number | null }) {
    const { data } = await http.post<ApiResponse>(`/bookings`, payload)
    return data
  },
  async createMulti(payload: { room_ids: number[]; customer_id: number; start_time: string; end_time: string; title?: string; notes?: string }) {
    const { data } = await http.post<ApiResponse>(`/bookings/multi`, payload)
    return data
  },
  async createRecurring(payload: { pattern: 'weekly' | 'monthly'; interval?: number; start_date: string; end_date?: string; start_time: string; end_time: string; customer_id: number; room_id?: number; room_ids?: number[]; byweekday?: number[]; bymonthday?: number[]; notes?: string }) {
    const { data } = await http.post<ApiResponse>(`/bookings/recurring`, payload)
    return data
  },
  async update(id: number, payload: Partial<{ start_time: string; end_time: string; status: 'confirmed' | 'cancelled'; notes: string; total_amount: number; staff_id: number | null }>) {
    const { data } = await http.put<ApiResponse>(`/bookings/${id}`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await http.delete<ApiResponse>(`/bookings/${id}`)
    return data
  },
}

export const bookingTemplatesAPI = {
  async list() {
    const { data } = await http.get<ApiResponse>(`/booking-templates`)
    return data
  },
  async create(payload: { name: string; payload: Record<string, unknown> }) {
    const { data } = await http.post<ApiResponse>(`/booking-templates`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await http.delete<ApiResponse>(`/booking-templates/${id}`)
    return data
  },
}

export const waitlistAPI = {
  async list(params?: { room_id?: number }) {
    const { data } = await http.get<ApiResponse>(`/waitlist`, { params })
    return data
  },
  async create(payload: { room_id: number; date: string; start_time: string; end_time: string; customer_id: number }) {
    const { data } = await http.post<ApiResponse>(`/waitlist`, payload)
    return data
  },
}

export const timeSlotsAPI = {
  async list(params?: { room_type?: string; room_id?: number }) {
    const { data } = await http.get<ApiResponse>(`/time-slots`, { params })
    return data
  },
  async create(payload: { label: string; start_time: string; end_time: string; days_of_week: number[]; room_type?: string; room_id?: number }) {
    const { data } = await http.post<ApiResponse>(`/time-slots`, payload)
    return data
  },
  async remove(id: number) {
    const { data } = await http.delete<ApiResponse>(`/time-slots/${id}`)
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
  async downloadOccupancyCsv(params?: { from?: string; to?: string; open_hours_per_day?: number }): Promise<Blob> {
    const resp = await http.get(`/reports/occupancy.csv`, { params, responseType: 'blob' })
    return resp.data
  },
  async downloadStaffCsv(params?: { from?: string; to?: string }): Promise<Blob> {
    const resp = await http.get(`/reports/staff.csv`, { params, responseType: 'blob' })
    return resp.data
  },
}

export const analyticsAPI = {
  async summary(params?: { from?: string; to?: string; open_hours_per_day?: number }) {
    const { data } = await http.get<ApiResponse>(`/analytics/summary`, { params })
    return data
  },
  async forecast(params?: { metric?: 'revenue' | 'bookings'; period?: 'monthly' | 'weekly'; months?: number }) {
    const { data } = await http.get<ApiResponse>(`/analytics/forecast`, { params })
    return data
  },
  async customers(params?: { from?: string; to?: string }) {
    const { data } = await http.get<ApiResponse>(`/analytics/customers`, { params })
    return data
  },
  async occupancy(params?: { from?: string; to?: string; open_hours_per_day?: number }) {
    const { data } = await http.get<ApiResponse>(`/analytics/occupancy`, { params })
    return data
  },
  async staff(params?: { from?: string; to?: string }) {
    const { data } = await http.get<ApiResponse>(`/analytics/staff`, { params })
    return data
  },
}

// Global Admin APIs
export const adminAPI = {
  async summary() {
    const { data } = await http.get<ApiResponse>(`/admin/summary`)
    return data
  },
  async tenants() {
    const { data } = await http.get<ApiResponse>(`/admin/tenants`)
    return data
  },
  async tenantsCreate(payload: { tenant_name: string; subdomain?: string; admin_name: string; admin_email: string; admin_password: string; plan?: string }) {
    const { data } = await http.post<ApiResponse>(`/admin/tenants`, payload)
    return data
  },
  async tenantsLiveBookings() {
    const { data } = await http.get<ApiResponse>(`/admin/tenants/live-bookings`)
    return data
  },
  async moveUser(payload: { user_id: number; target_tenant_id: number; target_studio_id?: number }) {
    const { data } = await http.post<ApiResponse>(`/admin/users/move`, payload)
    return data
  },
  async setUserRole(payload: { user_id: number; role: string }) {
    const { data } = await http.post<ApiResponse>(`/admin/users/role`, payload)
    return data
  },
  async messagesList() {
    const { data } = await http.get<ApiResponse>(`/admin/messages`)
    return data
  },
  async messagesCreate(payload: { title: string; body: string; tenant_id?: number }) {
    const { data } = await http.post<ApiResponse>(`/admin/messages`, payload)
    return data
  },
  async licensesList() {
    const { data } = await http.get<ApiResponse>(`/admin/licenses`)
    return data
  },
  async licensesCreate(payload: { key?: string; plan: string; seats?: number; expires_at?: string; tenant_id?: number }) {
    const { data } = await http.post<ApiResponse>(`/admin/licenses`, payload)
    return data
  },
  async licensesAssign(payload: { license_id: number; user_id?: number; tenant_id?: number }) {
    const { data } = await http.post<ApiResponse>(`/admin/licenses/assign`, payload)
    return data
  },
  async downloadBookingsCsv(): Promise<Blob> {
    const resp = await http.get(`/admin/reports/bookings.csv`, { responseType: 'blob' })
    return resp.data
  },
  async downloadRevenueCsv(): Promise<Blob> {
    const resp = await http.get(`/admin/reports/revenue.csv`, { responseType: 'blob' })
    return resp.data
  },
  async tenantAdminsList(tenantId: number, params?: { page?: number; per_page?: number; search?: string }) {
  const { data } = await http.get<ApiResponse>(`/admin/tenants/${tenantId}/admins`, { params })
    return data
  },
  async tenantAdminsCreate(tenantId: number, payload: { name: string; email: string; password: string }) {
    const { data } = await http.post<ApiResponse>(`/admin/tenants/${tenantId}/admins`, payload)
    return data
  },
  async tenantUsersList(tenantId: number, params?: { page?: number; per_page?: number; search?: string }) {
    const { data } = await http.get<ApiResponse>(`/admin/tenants/${tenantId}/users`, { params })
    return data
  },
  async tenantAdminDelete(tenantId: number, userId: number) {
    const { data } = await http.delete<ApiResponse>(`/admin/tenants/${tenantId}/admins/${userId}`)
    return data
  },
  async tenantAdminChangeRole(tenantId: number, userId: number, role: string) {
    const { data } = await http.post<ApiResponse>(`/admin/tenants/${tenantId}/admins/${userId}/role`, { role })
    return data
  },
  async tenantUsersCreate(tenantId: number, payload: { name: string; email: string; password: string; role: string }) {
    const { data } = await http.post<ApiResponse>(`/admin/tenants/${tenantId}/users`, payload)
    return data
  },
  async tenantSuspend(tenantId: number) {
    const { data } = await http.post<ApiResponse>(`/admin/tenants/${tenantId}/suspend`)
    return data
  },
  async tenantEnable(tenantId: number) {
    const { data } = await http.post<ApiResponse>(`/admin/tenants/${tenantId}/enable`)
    return data
  },
  async tenantDelete(tenantId: number) {
    const { data } = await http.delete<ApiResponse>(`/admin/tenants/${tenantId}`)
    return data
  },
}

// Tenant-facing announcements
export const announcementsAPI = {
  async list(params?: { limit?: number }) {
    const { data } = await http.get<ApiResponse>(`/announcements`, { params })
    return data
  },
}

// Customer Portal APIs
export const portalAPI = {
  async requestOtp(email: string) {
    const { data } = await http.post<ApiResponse>(`/portal/otp/request`, { email })
    return data
  },
  async verifyOtp(email: string, code: string) {
    const { data } = await http.post<ApiResponse<{ customer: { id: number; name: string; email: string; loyalty_points: number } }>>(`/portal/otp/verify`, { email, code })
    return data
  },
  async session() {
    const { data } = await http.get<ApiResponse<{ customer: { id: number; name: string; email: string; loyalty_points: number } }>>(`/portal/session`)
    return data
  },
  async logout() {
    const { data } = await http.post<ApiResponse>(`/portal/logout`)
    return data
  },
  async listBookings(params: { from?: string; to?: string } = {}) {
    const { data } = await http.get<ApiResponse<any[]>>(`/portal/bookings`, { params })
    return data
  },
  async createBooking(input: { room_id: number; start_time: string; end_time: string; notes?: string }) {
    const { data } = await http.post<ApiResponse<any>>(`/portal/bookings`, input)
    return data
  },
  async cancelBooking(id: number) {
    const { data } = await http.delete<ApiResponse>(`/portal/bookings/${id}`)
    return data
  },
  async loyalty() {
    const { data } = await http.get<ApiResponse<{ points: number; transactions: any[] }>>(`/portal/loyalty`)
    return data
  },
  async applyReferral(code: string) {
    const { data } = await http.post<ApiResponse>(`/portal/referral/apply`, { code })
    return data
  },
  async getQrCode(bookingId: number) {
    const { data } = await http.get<ApiResponse<{ code: string; expires_at: string }>>(`/portal/checkins/${bookingId}/qr`)
    return data
  },
}

export const checkinsAPI = {
  async scan(code: string) {
    const { data } = await http.post<ApiResponse<{ booking_id: number; customer_id: number; checked_in_at: string }>>(`/checkins/scan`, { code })
    return data
  }
}
