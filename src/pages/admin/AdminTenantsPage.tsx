import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { adminAPI } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'

export function AdminTenantsPage() {
  const { user } = useAuth()
  const [tenants, setTenants] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10
  const { notify } = useToast()

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

  if (user?.role !== 'SuperAdmin') return <div className="p-6">Access denied</div>

  useEffect(() => {
    if (error) notify({ kind: 'error', message: error })
  }, [error])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return tenants
    return tenants.filter(t => `${t.name} ${t.subdomain} ${t.plan}`.toLowerCase().includes(q))
  }, [tenants, query])

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage))
  const pageItems = filtered.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Tenants</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Manage all tenants.</p>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="mb-3 flex items-center gap-3">
            <Input placeholder="Search tenants..." value={query} onChange={(e) => { setPage(1); setQuery(e.target.value) }} />
          </div>
          <div className="overflow-x-auto">
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
              {pageItems.map(t => (
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
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-gray-600 dark:text-gray-300">Page {page} of {totalPages} · {filtered.length} total</div>
            <div className="flex gap-2">
              <Button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
              <Button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
            </div>
          </div>
        </div>
      </div>
      {error && <div className="text-red-600">{error}</div>}
    </div>
  )
}
