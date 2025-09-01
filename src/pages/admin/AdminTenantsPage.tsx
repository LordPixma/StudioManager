import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { adminAPI, tenantsAPI } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { Select } from '../../components/ui/Select'

export function AdminTenantsPage() {
  const { user } = useAuth()
  const [tenants, setTenants] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const perPage = 10
  const { notify } = useToast()
  const [liveCounts, setLiveCounts] = useState<Record<number, number>>({})
  // Create Company form
  const [showCreate, setShowCreate] = useState(false)
  const [tenantName, setTenantName] = useState('')
  const [subdomain, setSubdomain] = useState('')
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [plan, setPlan] = useState('free')

  // Manage panel
  const [managingId, setManagingId] = useState<number | null>(null)
  const [admins, setAdmins] = useState<any[]>([])
  const [newAdminName, setNewAdminName] = useState('')
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [newAdminPassword, setNewAdminPassword] = useState('')
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserRole, setNewUserRole] = useState('Receptionist')
  const [editName, setEditName] = useState('')
  const [editPlan, setEditPlan] = useState('free')
  const [editActive, setEditActive] = useState(true)

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

  // Load live bookings counts
  const loadLiveCounts = async () => {
    const res = await adminAPI.tenantsLiveBookings()
    if (res.success) {
      const map: Record<number, number> = {}
      for (const row of (res.data || [])) map[row.tenant_id] = row.cnt
      setLiveCounts(map)
    }
  }
  useEffect(() => { loadLiveCounts() }, [])

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

  const refreshTenants = async () => {
    const res = await adminAPI.tenants()
    if (res.success) setTenants(res.data || [])
  }

  const createCompany = async () => {
    if (!tenantName.trim() || !adminName.trim() || !adminEmail.trim() || !adminPassword) {
      notify({ kind: 'error', message: 'All required fields must be filled' }); return
    }
    const res = await adminAPI.tenantsCreate({ tenant_name: tenantName.trim(), subdomain: subdomain.trim() || undefined, admin_name: adminName.trim(), admin_email: adminEmail.trim(), admin_password: adminPassword, plan })
    if (res.success) { notify({ kind: 'success', message: 'Company created' }); setShowCreate(false); setTenantName(''); setSubdomain(''); setAdminName(''); setAdminEmail(''); setAdminPassword(''); await refreshTenants() }
    else notify({ kind: 'error', message: res.message || 'Failed to create company' })
  }

  const openManage = async (t: any) => {
    setManagingId(t.id)
    setEditName(t.name)
    setEditPlan(t.plan)
    setEditActive(!!t.is_active)
    const res = await adminAPI.tenantAdminsList(t.id)
    if (res.success) setAdmins(res.data || [])
  }

  const saveCompany = async () => {
    if (!managingId) return
    const res = await tenantsAPI.update(managingId, { name: editName, plan: editPlan, is_active: editActive })
    if (res.success) { notify({ kind: 'success', message: 'Company updated' }); await refreshTenants() }
    else notify({ kind: 'error', message: res.message || 'Failed to update' })
  }

  const toggleTenantActive = async (t: any) => {
    const action = t.is_active ? adminAPI.tenantSuspend : adminAPI.tenantEnable
    const res = await action(t.id)
    if (res.success) { notify({ kind: 'success', message: t.is_active ? 'Suspended' : 'Enabled' }); await refreshTenants() }
    else notify({ kind: 'error', message: res.message || 'Failed to update' })
  }

  const deleteTenant = async (t: any) => {
    if (!confirm(`Delete ${t.name}? This cannot be undone.`)) return
    const res = await adminAPI.tenantDelete(t.id)
    if (res.success) { notify({ kind: 'success', message: 'Tenant deleted' }); await refreshTenants() }
    else notify({ kind: 'error', message: res.message || 'Failed to delete' })
  }

  const addCompanyAdmin = async () => {
    if (!managingId) return
    const res = await adminAPI.tenantAdminsCreate(managingId, { name: newAdminName.trim(), email: newAdminEmail.trim(), password: newAdminPassword })
    if (res.success) { notify({ kind: 'success', message: 'Admin added' }); setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword(''); const list = await adminAPI.tenantAdminsList(managingId); if (list.success) setAdmins(list.data || []) }
    else notify({ kind: 'error', message: res.message || 'Failed to add admin' })
  }

  const removeCompanyAdmin = async (uid: number) => {
    if (!managingId) return
    const res = await adminAPI.tenantAdminDelete(managingId, uid)
    if (res.success) { notify({ kind: 'success', message: 'Admin removed' }); const list = await adminAPI.tenantAdminsList(managingId); if (list.success) setAdmins(list.data || []) }
    else notify({ kind: 'error', message: res.message || 'Failed to remove admin' })
  }

  const changeAdminRole = async (uid: number, role: string) => {
    if (!managingId) return
    const res = await adminAPI.tenantAdminChangeRole(managingId, uid, role)
    if (res.success) { notify({ kind: 'success', message: 'Role updated' }); const list = await adminAPI.tenantAdminsList(managingId); if (list.success) setAdmins(list.data || []) }
    else notify({ kind: 'error', message: res.message || 'Failed to update role' })
  }

  const addUser = async () => {
    if (!managingId) return
    const res = await adminAPI.tenantUsersCreate(managingId, { name: newUserName.trim(), email: newUserEmail.trim(), password: newUserPassword, role: newUserRole })
    if (res.success) { notify({ kind: 'success', message: 'User added' }); setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); setNewUserRole('Receptionist') }
    else notify({ kind: 'error', message: res.message || 'Failed to add user' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Tenants</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Manage all tenants.</p>
      </div>
      {/* Create Company */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="font-medium">Add Company</h3>
          <Button onClick={() => setShowCreate((v) => !v)}>{showCreate ? 'Hide' : 'Show'}</Button>
        </div>
        {showCreate && (
          <div className="card-body grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3"><label className="form-label">Company Name</label><Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} /></div>
            <div><label className="form-label">Subdomain</label><Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="optional" /></div>
            <div><label className="form-label">Plan</label><Select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></Select></div>
            <div className="sm:col-span-3 border-t border-gray-200 dark:border-gray-800 pt-3 font-medium">Company Admin</div>
            <div><label className="form-label">Admin Name</label><Input value={adminName} onChange={(e) => setAdminName(e.target.value)} /></div>
            <div><label className="form-label">Admin Email</label><Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></div>
            <div><label className="form-label">Admin Password</label><Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></div>
            <div className="sm:col-span-3"><Button onClick={createCompany}>Create Company</Button></div>
          </div>
        )}
      </div>
      <div className="card">
        <div className="card-body">
          <div className="mb-3 flex items-center gap-3">
            <Input placeholder="Search tenants..." value={query} onChange={(e) => { setPage(1); setQuery(e.target.value) }} />
            <Button onClick={loadLiveCounts}>Refresh Live Bookings</Button>
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
                <th className="py-2 pr-4">Live Bookings</th>
                <th className="py-2 pr-4">Actions</th>
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
                  <td className="py-2 pr-4">{liveCounts[t.id] ?? 0}</td>
                  <td className="py-2 pr-4 flex gap-2">
                    <Button onClick={() => openManage(t)}>Manage</Button>
                    <Button onClick={() => toggleTenantActive(t)}>{t.is_active ? 'Suspend' : 'Enable'}</Button>
                    <Button onClick={() => deleteTenant(t)}>Delete</Button>
                  </td>
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
      {/* Manage panel */}
      {managingId && (
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <h3 className="font-medium">Manage Company (ID {managingId})</h3>
            <Button onClick={() => setManagingId(null)}>Close</Button>
          </div>
          <div className="card-body space-y-6">
            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2"><label className="form-label">Name</label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
              <div><label className="form-label">Plan</label><Select value={editPlan} onChange={(e) => setEditPlan(e.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></Select></div>
              <div><label className="form-label">Active</label><Select value={editActive ? '1' : '0'} onChange={(e) => setEditActive(e.target.value === '1')}><option value="1">Active</option><option value="0">Suspended</option></Select></div>
              <div className="sm:col-span-3"><Button onClick={saveCompany}>Save</Button></div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Company Admins (max 2)</h4>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead><tr className="text-left"><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Actions</th></tr></thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                    {admins.map(a => (
                      <tr key={a.id}><td className="py-2 pr-4">{a.name}</td><td className="py-2 pr-4">{a.email}</td><td className="py-2 pr-4">{a.role}</td><td className="py-2 pr-4 flex gap-2"><Select value={a.role} onChange={(e) => changeAdminRole(a.id, e.target.value)}><option value="Admin">Admin</option><option value="Studio Manager">Studio Manager</option><option value="Receptionist">Receptionist</option><option value="Staff/Instructor">Staff/Instructor</option></Select><Button onClick={() => removeCompanyAdmin(a.id)}>Delete</Button></td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <div><label className="form-label">Admin Name</label><Input value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} /></div>
                <div><label className="form-label">Admin Email</label><Input value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} /></div>
                <div><label className="form-label">Admin Password</label><Input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} /></div>
                <div className="sm:col-span-3"><Button onClick={addCompanyAdmin} disabled={admins.length >= 2}>Add Admin</Button></div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Add User</h4>
              <div className="grid sm:grid-cols-4 gap-3">
                <div><label className="form-label">Name</label><Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} /></div>
                <div><label className="form-label">Email</label><Input value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} /></div>
                <div><label className="form-label">Password</label><Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} /></div>
                <div><label className="form-label">Role</label><Select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)}><option value="Receptionist">Receptionist</option><option value="Studio Manager">Studio Manager</option><option value="Staff/Instructor">Staff/Instructor</option><option value="Admin">Admin</option></Select></div>
                <div className="sm:col-span-4"><Button onClick={addUser}>Add User</Button></div>
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <div className="text-red-600">{error}</div>}
    </div>
  )
}
