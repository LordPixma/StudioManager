import { useEffect, useState } from 'react'
import { adminAPI } from '../../lib/api'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Button } from '../../components/ui/Button'

export function AdminUsersPage() {
  const [userId, setUserId] = useState('')
  const [targetTenantId, setTargetTenantId] = useState('')
  const [targetStudioId, setTargetStudioId] = useState('')
  const [result, setResult] = useState<string>('')

  const move = async () => {
    const uid = parseInt(userId, 10)
    const tid = parseInt(targetTenantId, 10)
    const sid = targetStudioId ? parseInt(targetStudioId, 10) : undefined
    const res = await adminAPI.moveUser({ user_id: uid, target_tenant_id: tid, target_studio_id: sid })
    if (res.success) setResult('User moved successfully')
    else setResult(res.message || 'Failed to move user')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Move User</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Move a user to a different tenant/studio.</p>
      </div>
      <div className="card">
        <div className="card-body grid sm:grid-cols-3 gap-3">
          <div>
            <label className="form-label">User ID</label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
          </div>
          <div>
            <label className="form-label">Target Tenant ID</label>
            <Input value={targetTenantId} onChange={(e) => setTargetTenantId(e.target.value)} placeholder="Tenant ID" />
          </div>
          <div>
            <label className="form-label">Target Studio ID (optional)</label>
            <Input value={targetStudioId} onChange={(e) => setTargetStudioId(e.target.value)} placeholder="Studio ID" />
          </div>
          <div className="sm:col-span-3">
            <Button onClick={move}>Move User</Button>
          </div>
          {result && <div className="sm:col-span-3 text-sm text-gray-700 dark:text-gray-300">{result}</div>}
        </div>
      </div>
    </div>
  )
}
