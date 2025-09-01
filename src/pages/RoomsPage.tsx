import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { roomsAPI } from '../lib/api'
import type { Room } from '../types'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
// import { Select } from '../components/ui/Select'
import { useToast } from '../components/ui/useToast'
import { Plus, RefreshCw, Trash2, Edit } from 'lucide-react'

type RoomForm = {
  name: string
  capacity?: number
  hourly_rate?: number
  equipment?: string // comma-separated for UX
}

export function RoomsPage() {
  const { notify } = useToast()
  const [rooms, setRooms] = useState<Room[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset } = useForm<RoomForm>()

  const load = async () => {
    try {
      setLoading(true)
      const res = await roomsAPI.list()
      if (res.success) setRooms(res.data || [])
      else setError(res.message || 'Failed to load rooms')
    } catch (e: any) {
      setError(e?.message || 'Failed to load rooms')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const onCreate = handleSubmit(async (values) => {
    setError(null)
    if (!values.name?.trim()) {
      const msg = 'Room name is required'
      setError(msg)
      notify({ kind: 'error', message: msg })
      return
    }
    try {
      const equipment = values.equipment
        ? values.equipment.split(',').map(s => s.trim()).filter(Boolean)
        : []
      const payload: Parameters<typeof roomsAPI.create>[0] = {
        name: values.name.trim(),
        capacity: values.capacity ? Number(values.capacity) : undefined,
        hourly_rate: values.hourly_rate ? Number(values.hourly_rate) : undefined,
        equipment,
      }
      const res = await roomsAPI.create(payload)
      if (res.success) {
        reset()
        await load()
        notify({ kind: 'success', message: 'Room added' })
      } else {
        const msg = res.message || 'Failed to add room'
        setError(msg)
        notify({ kind: 'error', message: msg })
      }
    } catch (e: any) {
      const msg = e?.response?.data?.message || e?.message || 'Failed to add room'
      setError(msg)
      notify({ kind: 'error', message: msg })
    }
  })

  const onDelete = async (id: number) => {
    try {
      const res = await roomsAPI.remove(id)
      if (res.success) {
        await load()
        notify({ kind: 'success', message: 'Room deleted' })
      } else {
        notify({ kind: 'error', message: res.message || 'Delete failed' })
      }
    } catch (e: any) {
      notify({ kind: 'error', message: e?.message || 'Delete failed' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rooms</h1>
          <p className="text-gray-600 mt-1">Add, edit, and remove rooms for bookings.</p>
        </div>
        <Button variant="secondary" onClick={load} className="inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Add Room</h3>
          </div>
          <div className="card-body">
            <form onSubmit={onCreate} className="space-y-4">
              <div>
                <label className="form-label">Name</label>
                <Input {...register('name', { required: true })} placeholder="e.g., Studio A" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Capacity</label>
                  <Input type="number" min={0} {...register('capacity', { valueAsNumber: true })} placeholder="e.g., 8" />
                </div>
                <div>
                  <label className="form-label">Hourly Rate ($)</label>
                  <Input type="number" step="0.01" min={0} {...register('hourly_rate', { valueAsNumber: true })} placeholder="e.g., 50" />
                </div>
              </div>
              <div>
                <label className="form-label">Equipment (comma separated)</label>
                <Input {...register('equipment')} placeholder="e.g., Piano, Mirror Wall" />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Add Room
                </Button>
                {loading && <span className="text-gray-500 text-sm">Loading…</span>}
                {error && <span className="text-red-600 text-sm">{error}</span>}
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Existing Rooms</h3>
          </div>
          <div className="card-body p-0">
            {rooms.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No rooms yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Capacity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rate</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active</th>
                      <th className="px-6 py-3" />
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rooms.map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-6 py-3 text-sm text-gray-900">{r.name}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{r.capacity ?? 0}</td>
                        <td className="px-6 py-3 text-sm text-gray-600">{r.hourly_rate != null ? `$${r.hourly_rate}` : '—'}</td>
                        <td className="px-6 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${r.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{r.is_active ? 'Yes' : 'No'}</span>
                        </td>
                        <td className="px-6 py-3 text-right">
                          {/* Future: inline edit */}
                          <Button variant="secondary" className="p-2 mr-2" disabled>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="secondary" className="p-2" onClick={() => onDelete(r.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
