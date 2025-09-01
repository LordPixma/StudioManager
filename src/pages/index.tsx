import { FileX, Plus, RefreshCw, Download } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { bookingsAPI, customerAPI, roomsAPI, staffAPI, reportsAPI } from '../lib/api'
import type { Booking, Room, Customer } from '../types'
import { downloadBlobAsFile } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { useToast } from '../components/ui/Toast'

export function BookingsPage() {
  const { notify } = useToast()
  const [rooms, setRooms] = useState<Room[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { register, handleSubmit, reset } = useForm<{ room_id: number; customer_id: number; date: string; start: string; end: string; notes?: string }>()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const [rRes, cRes, bRes] = await Promise.all([
          roomsAPI.list(),
          customerAPI.getAll({ per_page: 100 }),
          bookingsAPI.list({}),
        ])
        if (mounted) {
          if (rRes.success) setRooms(rRes.data || [])
          if (cRes.success) setCustomers((cRes as any).data?.items || cRes.data || [])
          if (bRes.success) setBookings(bRes.data || [])
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => {
      mounted = false
    }
  }, [])

  const onCreate = handleSubmit(async (values) => {
    setError(null)
    try {
      const start_time = new Date(`${values.date}T${values.start}:00`)
      const end_time = new Date(`${values.date}T${values.end}:00`)
      const res = await bookingsAPI.create({
        room_id: Number(values.room_id),
        customer_id: Number(values.customer_id),
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        notes: values.notes,
        status: 'confirmed',
      })
      if (res.success) {
        const list = await bookingsAPI.list({})
        if (list.success) setBookings(list.data || [])
        reset()
      } else {
        setError(res.message || 'Failed to create booking')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to create booking')
    }
    if (!error) notify({ kind: 'success', message: 'Booking created' })
    else notify({ kind: 'error', message: error })
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-1">Manage room bookings and reservations.</p>
        </div>
        <Button variant="secondary" onClick={() => window.location.reload()} className="inline-flex items-center gap-2">
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Create Booking</h3>
          </div>
          <div className="card-body">
            <form onSubmit={onCreate} className="space-y-4">
              <div>
                <label className="form-label">Room</label>
                <Select {...register('room_id', { required: true, valueAsNumber: true })}>
                  <option value="">Select a room</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="form-label">Customer</label>
                <Select {...register('customer_id', { required: true, valueAsNumber: true })}>
                  <option value="">Select a customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="form-label">Date</label>
                  <Input type="date" {...register('date', { required: true })} />
                </div>
                <div>
                  <label className="form-label">Start</label>
                  <Input type="time" step="900" {...register('start', { required: true })} />
                </div>
                <div>
                  <label className="form-label">End</label>
                  <Input type="time" step="900" {...register('end', { required: true })} />
                </div>
              </div>
              <div>
                <label className="form-label">Notes (optional)</label>
                <Textarea placeholder="Optional notes" {...register('notes')} />
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" className="inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Create Booking
                </Button>
                {loading && <span className="text-gray-500 text-sm">Loading…</span>}
                {error && <span className="text-red-600 text-sm">{error}</span>}
              </div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium">Upcoming Bookings</h3>
          </div>
          <div className="card-body">
            {bookings.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No bookings yet</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {bookings.map((b) => {
                  const room = rooms.find((r) => r.id === b.room_id)
                  const customer = customers.find((c) => c.id === b.customer_id)
                  const start = new Date(b.start_time)
                  const end = new Date(b.end_time)
                  return (
                    <li key={b.id} className="py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{room?.name || `Room #${b.room_id}`} · {customer?.name || `Customer #${b.customer_id}`}</div>
                          <div className="text-sm text-gray-600">{start.toLocaleString()} – {end.toLocaleTimeString()}</div>
                        </div>
                        <span className="text-xs px-2 py-1 rounded bg-green-100 text-green-800">{b.status}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function StaffPage() {
  const { notify } = useToast()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { register, handleSubmit, reset } = useForm<{ name: string; email: string; role?: string }>()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const res = await staffAPI.list()
        if (mounted && res.success) setStaff(res.data || [])
      } catch (e: any) {
        setError(e?.message || 'Failed to load staff')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const onCreate = handleSubmit(async (values) => {
    setError(null)
    try {
      const res = await staffAPI.create({ name: values.name, email: values.email, role: values.role || 'Staff/Instructor' })
      if (res.success) {
        reset()
        const list = await staffAPI.list()
        if (list.success) setStaff(list.data || [])
      } else {
        setError(res.message || 'Failed to add staff')
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to add staff')
    }
    if (!error) notify({ kind: 'success', message: 'Staff member added' })
    else notify({ kind: 'error', message: error })
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-gray-600 mt-1">Manage staff members and session assignments.</p>
        </div>
  <Button variant="secondary" onClick={() => window.location.reload()} className="inline-flex items-center gap-2"><RefreshCw className="h-4 w-4"/> Refresh</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Add Staff</h3></div>
          <div className="card-body">
            <form onSubmit={onCreate} className="space-y-4">
              <div>
                <label className="form-label">Name</label>
                <Input {...register('name', { required: true })} />
              </div>
              <div>
                <label className="form-label">Email</label>
                <Input type="email" {...register('email', { required: true })} />
              </div>
              <div>
                <label className="form-label">Role</label>
                <Select {...register('role')}>
                  <option>Staff/Instructor</option>
                  <option>Receptionist</option>
                  <option>Studio Manager</option>
                </Select>
              </div>
              <div className="flex items-center gap-3">
                <Button type="submit" className="inline-flex items-center gap-2"><Plus className="h-4 w-4"/> Add</Button>
                {loading && <span className="text-gray-500 text-sm">Loading…</span>}
                {error && <span className="text-red-600 text-sm">{error}</span>}
              </div>
            </form>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Team</h3></div>
          <div className="card-body">
            {staff.length === 0 ? (
              <div className="text-gray-500 text-center py-8">No staff yet</div>
            ) : (
              <ul className="divide-y divide-gray-200">
                {staff.map((s) => (
                  <li key={s.id} className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">{s.name} <span className="text-gray-500">· {s.email}</span></div>
                        <div className="text-sm text-gray-600">{s.role || 'Staff'}</div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function ReportsPage() {
  const [downloading, setDownloading] = useState<'bookings' | 'revenue' | null>(null)
  const { notify } = useToast()
  const handleDownload = async (kind: 'bookings' | 'revenue') => {
    try {
      setDownloading(kind)
      const blob = kind === 'bookings' ? await reportsAPI.downloadBookingsCsv() : await reportsAPI.downloadRevenueCsv()
      downloadBlobAsFile(blob, `${kind}.csv`)
      notify({ kind: 'success', message: `${kind === 'bookings' ? 'Bookings' : 'Revenue'} report downloaded` })
    } catch (e) {
      notify({ kind: 'error', message: 'Failed to download report' })
    } finally {
      setDownloading(null)
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
          <p className="text-gray-600 mt-1">Analytics and reporting for your studio performance.</p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Bookings CSV</h3></div>
          <div className="card-body">
            <Button disabled={downloading === 'bookings'} onClick={() => handleDownload('bookings')} className="inline-flex items-center gap-2">
              <Download className="h-4 w-4"/> {downloading === 'bookings' ? 'Downloading…' : 'Download'}
            </Button>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Revenue CSV</h3></div>
          <div className="card-body">
            <Button disabled={downloading === 'revenue'} onClick={() => handleDownload('revenue')} className="inline-flex items-center gap-2">
              <Download className="h-4 w-4"/> {downloading === 'revenue' ? 'Downloading…' : 'Download'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <FileX className="h-24 w-24 text-gray-400 mx-auto mb-4" />
        <h1 className="text-6xl font-bold text-gray-900">404</h1>
        <h2 className="text-2xl font-medium text-gray-600 mt-4">Page Not Found</h2>
        <p className="text-gray-500 mt-2">
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/dashboard"
          className="btn-primary inline-block mt-6"
        >
          Go to Dashboard
        </a>
      </div>
    </div>
  )
}