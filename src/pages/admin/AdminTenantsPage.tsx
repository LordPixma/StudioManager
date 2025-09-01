import { useEffect, useState } from 'react'
import { adminAPI } from '../../lib/api'
import { Button } from '../../components/ui/Button'

export function AdminTenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const res = await adminAPI.tenants()
        if (mounted && res.success) setTenants(res.data || [])
        else if (mounted) setError(res.message || 'Failed to load tenants')
      } catch (e: any) { if (mounted) setError(e?.message || 'Failed to load') }
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Tenants</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Manage all tenants.</p>
      </div>
      <div className="card">
        <div className="card-body overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Subdomain</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Active</th>
                <th className="py-2 pr-4">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {tenants.map(t => (
                <tr key={t.id}>
                  <td className="py-2 pr-4">{t.name}</td>
                  <td className="py-2 pr-4">{t.subdomain}</td>
                  <td className="py-2 pr-4">{t.plan}</td>
                  <td className="py-2 pr-4">{t.is_active ? 'Yes' : 'No'}</td>
                  <td className="py-2 pr-4">{new Date(t.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
    </div>
  )
}
