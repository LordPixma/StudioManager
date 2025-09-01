import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { ToastProvider } from './components/ui/Toast'
import { TenantSettingsProvider } from './hooks/useTenantSettings'

// Pages
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { DashboardPage } from './pages/DashboardPage'
import { CustomersPage } from './pages/CustomersPage'
import { BookingsPage } from './pages/BookingsPage'
import { StaffPage } from './pages/StaffPage'
import { RoomsPage } from './pages/RoomsPage'
import { ReportsPage } from './pages/ReportsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SettingsPage } from './pages/SettingsPage'
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage'
import { AdminTenantsPage } from './pages/admin/AdminTenantsPage'
import { AdminUsersPage } from './pages/admin/AdminUsersPage'
import { AdminMessagesPage } from './pages/admin/AdminMessagesPage'
import { AdminLicensesPage } from './pages/admin/AdminLicensesPage'
import { AdminAnalyticsPage } from './pages/admin/AdminAnalyticsPage'

function App() {
  return (
    <AuthProvider>
      <TenantSettingsProvider>
      <ToastProvider>
        <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        
        {/* Protected routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          {/* Global admin routes (Admin only) */}
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/tenants" element={<AdminTenantsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/messages" element={<AdminMessagesPage />} />
          <Route path="/admin/licenses" element={<AdminLicensesPage />} />
          <Route path="/admin/analytics" element={<AdminAnalyticsPage />} />
        </Route>
        
        {/* 404 fallback */}
        <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ToastProvider>
      </TenantSettingsProvider>
    </AuthProvider>
  )
}

export default App