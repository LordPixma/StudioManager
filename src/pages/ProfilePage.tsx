import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useAuth } from '../hooks/useAuthHook'
import { userAPI } from '../lib/api'
import { useAuthStore } from '../store/authStore'

type ProfileForm = {
  name?: string
  phone?: string
  bio?: string
  timezone?: string
  avatar_url?: string
}

export function ProfilePage() {
  const { user } = useAuth()
  const updateUser = useAuthStore((s) => s.updateUser)
  const { register, handleSubmit, reset, setValue, watch } = useForm<ProfileForm>()
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const res = await userAPI.me()
      if (res.success && res.data) {
        const u = res.data as any
        reset({
          name: u.name || '',
          phone: u.phone || '',
          bio: u.bio || '',
          timezone: u.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
          avatar_url: u.avatar_url || '',
        })
      }
    }
    load()
  }, [reset])

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[1] || e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) return
    // Try R2 upload first (2MB limit server-side)
    try {
      const res = await userAPI.uploadAvatar(file)
      if (res.success && res.data?.url) {
        setValue('avatar_url', res.data.url)
        updateUser({ avatar_url: res.data.url })
        return
      }
    } catch {}
    // Fallback: small inline data URL for preview
    if (file.size <= 200 * 1024) {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result || '')
        setValue('avatar_url', dataUrl)
      }
      reader.readAsDataURL(file)
    } else {
      alert('Avatar upload failed and file is too large for inline preview (200KB).')
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setSaving(true)
    try {
      const res = await userAPI.updateMe(values)
      if (!res.success) {
        alert(res.message || 'Update failed')
      } else {
        alert('Profile saved')
  // Update local store
  updateUser(values)
      }
    } finally {
      setSaving(false)
    }
  })

  const avatarUrl = watch('avatar_url')

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold mb-4">Your Profile</h1>
      <form onSubmit={onSubmit} className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 rounded-full bg-gray-200 overflow-hidden">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-gray-500">No Image</div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Profile picture</label>
            <input type="file" accept="image/*" onChange={onFileChange} className="mt-1 block" />
            <p className="text-xs text-gray-500">PNG/JPG under 200KB.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Name</label>
            <input className="form-input" placeholder="Your name" {...register('name')} />
          </div>
          <div>
            <label className="form-label">Email</label>
            <input className="form-input" value={user?.email || ''} disabled />
          </div>
          <div>
            <label className="form-label">Phone</label>
            <input className="form-input" placeholder="+1 555-555-5555" {...register('phone')} />
          </div>
          <div>
            <label className="form-label">Timezone</label>
            <input className="form-input" placeholder="e.g., America/New_York" {...register('timezone')} />
          </div>
        </div>

        <div>
          <label className="form-label">Bio</label>
          <textarea className="form-textarea" rows={4} placeholder="Short bio or notes" {...register('bio')} />
        </div>

        <div>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
        </div>
      </form>
    </div>
  )
}

export default ProfilePage
