import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { adminAPI, tenantsAPI } from '../../lib/api'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { useToast } from '../../components/ui/Toast'
import { Select } from '../../components/ui/Select'
import { Modal } from '../../components/ui/Modal'

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
  const [adminsPage, setAdminsPage] = useState(1)
  const [adminsTotal, setAdminsTotal] = useState(0)
  const adminsPerPage = 10
  const [users, setUsers] = useState<any[]>([])
  const [usersPage, setUsersPage] = useState(1)
  const [usersTotal, setUsersTotal] = useState(0)
  const usersPerPage = 10
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
  // Tenant notification
  const [notifyTitle, setNotifyTitle] = useState('')
  const [notifyBody, setNotifyBody] = useState('')

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
  const res = await adminAPI.tenantAdminsList(t.id, { page: 1, per_page: adminsPerPage })
    if (res.success) { setAdmins(res.data || []); setAdminsTotal(res.meta?.total_count || (res.data?.length || 0)); setAdminsPage(1) }
    const ur = await adminAPI.tenantUsersList(t.id, { page: 1, per_page: usersPerPage })
    if (ur.success) { setUsers(ur.data || []); setUsersTotal(ur.meta?.total_count || (ur.data?.length || 0)); setUsersPage(1) }
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
    if (res.success) {
      notify({ kind: 'success', message: 'Admin added' }); setNewAdminName(''); setNewAdminEmail(''); setNewAdminPassword('');
  const list = await adminAPI.tenantAdminsList(managingId, { page: 1, per_page: adminsPerPage })
      if (list.success) { setAdmins(list.data || []); setAdminsTotal(list.meta?.total_count || (list.data?.length || 0)); setAdminsPage(1) }
    }
    else notify({ kind: 'error', message: res.message || 'Failed to add admin' })
  }

  const removeCompanyAdmin = async (uid: number) => {
    if (!managingId) return
    const res = await adminAPI.tenantAdminDelete(managingId, uid)
    if (res.success) {
      notify({ kind: 'success', message: 'Admin removed' });
  const list = await adminAPI.tenantAdminsList(managingId, { page: adminsPage, per_page: adminsPerPage })
      if (list.success) { setAdmins(list.data || []); setAdminsTotal(list.meta?.total_count || (list.data?.length || 0)) }
    }
    else notify({ kind: 'error', message: res.message || 'Failed to remove admin' })
  }

  const changeAdminRole = async (uid: number, role: string) => {
    if (!managingId) return
    const res = await adminAPI.tenantAdminChangeRole(managingId, uid, role)
    if (res.success) {
      notify({ kind: 'success', message: 'Role updated' });
  const list = await adminAPI.tenantAdminsList(managingId, { page: adminsPage, per_page: adminsPerPage })
      if (list.success) { setAdmins(list.data || []); setAdminsTotal(list.meta?.total_count || (list.data?.length || 0)) }
    }
    else notify({ kind: 'error', message: res.message || 'Failed to update role' })
  }

  const addUser = async () => {
    if (!managingId) return
    const res = await adminAPI.tenantUsersCreate(managingId, { name: newUserName.trim(), email: newUserEmail.trim(), password: newUserPassword, role: newUserRole })
    if (res.success) {
      notify({ kind: 'success', message: 'User added' }); setNewUserName(''); setNewUserEmail(''); setNewUserPassword(''); setNewUserRole('Receptionist')
      const ur = await adminAPI.tenantUsersList(managingId, { page: 1, per_page: usersPerPage })
      if (ur.success) { setUsers(ur.data || []); setUsersTotal(ur.meta?.total_count || (ur.data?.length || 0)); setUsersPage(1) }
    }
    else notify({ kind: 'error', message: res.message || 'Failed to add user' })
  }

  const sendTenantNotification = async () => {
    if (!managingId) return
    if (!notifyTitle.trim() || !notifyBody.trim()) { notify({ kind: 'error', message: 'Title and body are required' }); return }
    const res = await adminAPI.messagesCreate({ title: notifyTitle.trim(), body: notifyBody.trim(), tenant_id: managingId })
    if (res.success) { notify({ kind: 'success', message: 'Notification sent' }); setNotifyTitle(''); setNotifyBody('') }
    else notify({ kind: 'error', message: res.message || 'Failed to send' })
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">All Tenants</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Manage all tenants.</p>
      </div>
      {/* Create Company */}
  <div className="flex justify-end"><Button onClick={() => setShowCreate(true)}>Add Company</Button></div>
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
      {/* Modals */}
      {showCreate && (
        <Modal title="Add Company" onClose={() => setShowCreate(false)}>
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-3"><label className="form-label">Company Name</label><Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} /></div>
            <div><label className="form-label">Subdomain</label><Input value={subdomain} onChange={(e) => setSubdomain(e.target.value)} placeholder="optional" /></div>
            <div><label className="form-label">Plan</label><Select value={plan} onChange={(e) => setPlan(e.target.value)}><option value="free">Free</option><option value="pro">Pro</option><option value="enterprise">Enterprise</option></Select></div>
            <div className="sm:col-span-3 border-t border-gray-200 dark:border-gray-800 pt-3 font-medium">Company Admin</div>
            <div><label className="form-label">Admin Name</label><Input value={adminName} onChange={(e) => setAdminName(e.target.value)} /></div>
            <div><label className="form-label">Admin Email</label><Input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} /></div>
            <div><label className="form-label">Admin Password</label><Input type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} /></div>
            <div className="sm:col-span-3 flex justify-end gap-2"><Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button><Button onClick={createCompany}>Create Company</Button></div>
          </div>
        </Modal>
      )}
      {managingId && (
        <Modal title={`Manage Company (ID ${managingId})`} onClose={() => setManagingId(null)}>
          <div className="space-y-6">
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
              <div className="flex items-center justify-between mt-2">
                <div className="text-sm text-gray-600 dark:text-gray-300">Page {adminsPage} of {Math.max(1, Math.ceil(adminsTotal / adminsPerPage))} · {adminsTotal} total</div>
                <div className="flex gap-2">
                  <Button disabled={adminsPage <= 1} onClick={async () => { const p = adminsPage - 1; setAdminsPage(p); const list = await adminAPI.tenantAdminsList(managingId!, { page: p, per_page: adminsPerPage }); if (list.success) { setAdmins(list.data || []); setAdminsTotal(list.meta?.total_count || (list.data?.length || 0)) } }}>Prev</Button>
                  <Button disabled={adminsPage >= Math.max(1, Math.ceil(adminsTotal / adminsPerPage))} onClick={async () => { const p = adminsPage + 1; setAdminsPage(p); const list = await adminAPI.tenantAdminsList(managingId!, { page: p, per_page: adminsPerPage }); if (list.success) { setAdmins(list.data || []); setAdminsTotal(list.meta?.total_count || (list.data?.length || 0)) } }}>Next</Button>
                </div>
              </div>
              <div className="grid sm:grid-cols-3 gap-3 mt-3">
                <div><label className="form-label">Admin Name</label><Input value={newAdminName} onChange={(e) => setNewAdminName(e.target.value)} /></div>
                <div><label className="form-label">Admin Email</label><Input value={newAdminEmail} onChange={(e) => setNewAdminEmail(e.target.value)} /></div>
                <div><label className="form-label">Admin Password</label><Input type="password" value={newAdminPassword} onChange={(e) => setNewAdminPassword(e.target.value)} /></div>
                <div className="sm:col-span-3"><Button onClick={addCompanyAdmin} disabled={adminsTotal >= 2}>Add Admin</Button></div>
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
              <div className="mt-4">
                <h5 className="font-medium mb-2">Users</h5>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead><tr className="text-left"><th className="py-2 pr-4">Name</th><th className="py-2 pr-4">Email</th><th className="py-2 pr-4">Role</th><th className="py-2 pr-4">Active</th></tr></thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                      {users.map(u => (<tr key={u.id}><td className="py-2 pr-4">{u.name}</td><td className="py-2 pr-4">{u.email}</td><td className="py-2 pr-4">{u.role}</td><td className="py-2 pr-4">{u.is_active ? 'Yes' : 'No'}</td></tr>))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-sm text-gray-600 dark:text-gray-300">Page {usersPage} of {Math.max(1, Math.ceil(usersTotal / usersPerPage))} · {usersTotal} total</div>
                  <div className="flex gap-2">
                    <Button disabled={usersPage <= 1} onClick={async () => { const p = usersPage - 1; setUsersPage(p); const ur = await adminAPI.tenantUsersList(managingId!, { page: p, per_page: usersPerPage }); if (ur.success) { setUsers(ur.data || []); setUsersTotal(ur.meta?.total_count || (ur.data?.length || 0)) } }}>Prev</Button>
                    <Button disabled={usersPage >= Math.max(1, Math.ceil(usersTotal / usersPerPage))} onClick={async () => { const p = usersPage + 1; setUsersPage(p); const ur = await adminAPI.tenantUsersList(managingId!, { page: p, per_page: usersPerPage }); if (ur.success) { setUsers(ur.data || []); setUsersTotal(ur.meta?.total_count || (ur.data?.length || 0)) } }}>Next</Button>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-2">Send Notification to this Tenant</h4>
              <div className="grid sm:grid-cols-1 gap-3">
                <div><label className="form-label">Title</label><Input value={notifyTitle} onChange={(e) => setNotifyTitle(e.target.value)} /></div>
                <div><label className="form-label">Body</label><textarea className="h-28 w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm" value={notifyBody} onChange={(e) => setNotifyBody(e.target.value)} /></div>
                <div><Button onClick={sendTenantNotification}>Send Notification</Button></div>
              </div>
            </div>
          </div>
        </Modal>
      )}
      {error && <div className="text-red-600">{error}</div>}
    </div>
  )
}
