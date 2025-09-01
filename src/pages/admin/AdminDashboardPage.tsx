import { useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuthHook'
import { adminAPI } from '../../lib/api'
import type { AdminSummary } from '../../types'
import { Button } from '../../components/ui/Button'

export function AdminDashboardPage() {
  const { user } = useAuth()
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
  const res = await adminAPI.summary()
  if (mounted && res.success) setSummary(res.data as AdminSummary)
        else if (mounted && !res.success) setError(res.message || 'Failed to load summary')
      } catch (e: any) {
        if (mounted) setError(e?.message || 'Failed to load')
      }
    })()
    return () => { mounted = false }
  }, [])

  if (user?.role !== 'SuperAdmin') {
    return <div className="p-6">Access denied</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Global Admin</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Platform summary and quick actions.</p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card"><div className="card-body"><div className="text-sm text-gray-500">Tenants</div><div className="text-2xl font-bold">{summary?.tenants ?? '—'}</div></div></div>
        <div className="card"><div className="card-body"><div className="text-sm text-gray-500">Active Tenants</div><div className="text-2xl font-bold">{summary?.active_tenants ?? '—'}</div></div></div>
        <div className="card"><div className="card-body"><div className="text-sm text-gray-500">Users</div><div className="text-2xl font-bold">{summary?.users ?? '—'}</div></div></div>
        <div className="card"><div className="card-body"><div className="text-sm text-gray-500">Bookings</div><div className="text-2xl font-bold">{summary?.bookings ?? '—'}</div></div></div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="font-medium">Reports</h3></div>
        <div className="card-body flex gap-3">
          <Button onClick={async () => {
            const blob = await adminAPI.downloadBookingsCsv();
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'platform-bookings.csv'; link.click();
          }}>Bookings CSV</Button>
          <Button onClick={async () => {
            const blob = await adminAPI.downloadRevenueCsv();
            const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'platform-revenue.csv'; link.click();
          }}>Revenue CSV</Button>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
    </div>
  )
}
