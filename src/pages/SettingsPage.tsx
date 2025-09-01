import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { tenantsAPI } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { useToast } from '../components/ui/Toast'

type TenantSettingsForm = {
  name: string
  plan: 'free' | 'basic' | 'premium' | 'enterprise'
  is_active: boolean
  // Advanced settings packed into settings JSON
  branding_primary?: string
  branding_logo_url?: string
  business_hours?: string // e.g., Mon-Fri 9-18
  cancellation_policy?: string
  default_hourly_rate?: number
}

export function SettingsPage() {
  const { user } = useAuth()
  const { notify } = useToast()
  const { register, handleSubmit, reset } = useForm<TenantSettingsForm>()
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchTenant = async () => {
      if (!user?.tenant_id) return
      try {
        setLoading(true)
        const res = await tenantsAPI.get(user.tenant_id)
        if (res.success && res.data) {
          const t = res.data as any
          const s = t.settings || {}
          reset({
            name: t.name || '',
            plan: t.plan || 'free',
            is_active: !!t.is_active,
            branding_primary: s.branding_primary || '#2563eb',
            branding_logo_url: s.branding_logo_url || '',
            business_hours: s.business_hours || 'Mon-Fri 09:00-18:00',
            cancellation_policy: s.cancellation_policy || '24 hours notice required',
            default_hourly_rate: s.default_hourly_rate ?? undefined,
          })
        }
      } finally {
        setLoading(false)
      }
    }
    fetchTenant()
  }, [user, reset])

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (!user?.tenant_id) {
        notify({ kind: 'error', message: 'No tenant to update' })
        return
      }
      const settings: Record<string, any> = {
        branding_primary: values.branding_primary,
        branding_logo_url: values.branding_logo_url,
        business_hours: values.business_hours,
        cancellation_policy: values.cancellation_policy,
        default_hourly_rate: values.default_hourly_rate,
      }
      const res = await tenantsAPI.update(user.tenant_id, {
        name: values.name || undefined,
        plan: values.plan,
        is_active: values.is_active,
        settings,
      })
      if (res.success) notify({ kind: 'success', message: 'Settings saved' })
      else notify({ kind: 'error', message: res.message || 'Save failed' })
    } catch (e: any) {
      notify({ kind: 'error', message: e?.message || 'Save failed' })
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-1">Manage tenant and account settings.</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Tenant</h3>
          </div>
          <div className="card-body">
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="form-label">Display Name</label>
                <Input placeholder="Your company or studio name" {...register('name')} />
              </div>
              <div>
                <label className="form-label">Plan</label>
                <Select {...register('plan')} defaultValue="free">
                  <option value="free">Free</option>
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="enterprise">Enterprise</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" {...register('is_active')} defaultChecked />
                <span className="text-sm text-gray-700">Active</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Brand Color</label>
                  <Input type="color" {...register('branding_primary')} />
                </div>
                <div>
                  <label className="form-label">Logo URL</label>
                  <Input placeholder="https://..." {...register('branding_logo_url')} />
                </div>
              </div>
              <div>
                <label className="form-label">Business Hours</label>
                <Input placeholder="Mon-Fri 09:00-18:00" {...register('business_hours')} />
              </div>
              <div>
                <label className="form-label">Cancellation Policy</label>
                <Input placeholder="24 hours notice required" {...register('cancellation_policy')} />
              </div>
              <div>
                <label className="form-label">Default Hourly Rate ($)</label>
                <Input type="number" step="0.01" {...register('default_hourly_rate', { valueAsNumber: true })} />
              </div>
              <div>
                <Button type="submit" disabled={loading}>{loading ? 'Saving…' : 'Save'}</Button>
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Profile</h3>
          </div>
          <div className="card-body space-y-2">
            <div className="text-sm text-gray-600">Name: <span className="text-gray-900 font-medium">{user?.name}</span></div>
            <div className="text-sm text-gray-600">Email: <span className="text-gray-900 font-medium">{user?.email}</span></div>
            <div className="text-sm text-gray-600">Role: <span className="text-gray-900 font-medium">{user?.role}</span></div>
          </div>
        </div>
      </div>
    </div>
  )
}
