import { useEffect, useState } from 'react'
import { adminAPI } from '../../lib/api'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'

export function AdminLicensesPage() {
  const [licenses, setLicenses] = useState<any[]>([])
  const [plan, setPlan] = useState('basic')
  const [seats, setSeats] = useState('1')
  const [expires, setExpires] = useState('')
  const [tenantId, setTenantId] = useState('')

  const load = async () => {
    const res = await adminAPI.licensesList()
    if (res.success) setLicenses(res.data || [])
  }
  useEffect(() => { load() }, [])

  const create = async () => {
    const res = await adminAPI.licensesCreate({ plan, seats: parseInt(seats, 10), expires_at: expires || undefined, tenant_id: tenantId ? parseInt(tenantId, 10) : undefined })
    if (res.success) { setPlan('basic'); setSeats('1'); setExpires(''); setTenantId(''); load() }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Licenses</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Create and manage licenses.</p>
      </div>
      <div className="card">
        <div className="card-body grid sm:grid-cols-4 gap-3">
          <div>
            <label className="form-label">Plan</label>
            <Select value={plan} onChange={(e) => setPlan(e.target.value)}>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
            </Select>
          </div>
          <div>
            <label className="form-label">Seats</label>
            <Input value={seats} onChange={(e) => setSeats(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Expires (ISO)</label>
            <Input placeholder="YYYY-MM-DD" value={expires} onChange={(e) => setExpires(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Tenant ID (optional)</label>
            <Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} />
          </div>
          <div className="sm:col-span-4"><Button onClick={create}>Create License</Button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="font-medium">Existing Licenses</h3></div>
        <div className="card-body overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left">
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Plan</th>
                <th className="py-2 pr-4">Seats</th>
                <th className="py-2 pr-4">Tenant</th>
                <th className="py-2 pr-4">Expires</th>
                <th className="py-2 pr-4">Active</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {licenses.map(l => (
                <tr key={l.id}>
                  <td className="py-2 pr-4">{l.key}</td>
                  <td className="py-2 pr-4">{l.plan}</td>
                  <td className="py-2 pr-4">{l.seats}</td>
                  <td className="py-2 pr-4">{l.tenant_id ?? '-'}</td>
                  <td className="py-2 pr-4">{l.expires_at ?? '-'}</td>
                  <td className="py-2 pr-4">{l.is_active ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
