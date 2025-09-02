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
import CalendarPage from './pages/CalendarPage'
import { StaffPage } from './pages/StaffPage'
import { RoomsPage } from './pages/RoomsPage'
import { ReportsPage } from './pages/ReportsPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SettingsPage } from './pages/SettingsPage'
import { ProfilePage } from './pages/ProfilePage'
// Customer Portal (public)
import PortalLoginPage from './pages/PortalLoginPage'
import PortalBookingsPage from './pages/PortalBookingsPage'
import PortalLoyaltyPage from './pages/PortalLoyaltyPage'
import PortalQrPage from './pages/PortalQrPage'
// Staff utility
import StaffCheckinPage from './pages/StaffCheckinPage'
// Admin pages are optional; disable imports if not present

function App() {
  return (
    <AuthProvider>
      <TenantSettingsProvider>
      <ToastProvider>
        <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
  {/* Customer portal public routes */}
  <Route path="/portal/login" element={<PortalLoginPage />} />
  <Route path="/portal/bookings" element={<PortalBookingsPage />} />
  <Route path="/portal/loyalty" element={<PortalLoyaltyPage />} />
  <Route path="/portal/qr" element={<PortalQrPage />} />
        
        {/* Protected routes */}
        <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/rooms" element={<RoomsPage />} />
          <Route path="/staff" element={<StaffPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/staff/checkin" element={<StaffCheckinPage />} />
          {/* Admin routes can be added here when pages exist */}
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