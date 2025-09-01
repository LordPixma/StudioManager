import { FileX, Plus, RefreshCw, Download, Edit, Trash2, Check, X as XIcon, Calendar as CalendarIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { bookingsAPI, customerAPI, roomsAPI, staffAPI, reportsAPI } from '../lib/api'
import type { Booking, Room, Customer } from '../types'
import { downloadBlobAsFile } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { Input } from '../components/ui/Input'
import { Textarea } from '../components/ui/Textarea'
import { useToast } from '../components/ui/useToast'
import { useTenantSettings } from '../hooks/useTenantSettingsHook'

export function BookingsPage() {
  const { notify } = useToast()
  const { settings } = useTenantSettings()
  const [rooms, setRooms] = useState<Room[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterRoomId, setFilterRoomId] = useState<number | ''>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [hardDelete, setHardDelete] = useState<boolean>(false)

  const { register, handleSubmit, reset, watch } = useForm<{ room_id: number; customer_id: number; date: string; start: string; end: string; notes?: string }>()
  const watchRoom = watch('room_id')
  const watchDate = watch('date')
  const watchStart = watch('start')
  const watchEnd = watch('end')

  const suggestedAmount = (() => {
    try {
      if (!watchRoom || !watchDate || !watchStart || !watchEnd) return null
      const room = rooms.find(r => r.id === Number(watchRoom))
      const start = new Date(`${watchDate}T${watchStart}:00`)
      const end = new Date(`${watchDate}T${watchEnd}:00`)
      if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null
      const hours = (end.getTime() - start.getTime())/36e5
      const rate = room?.hourly_rate ?? Number(settings?.default_hourly_rate)
      if (!rate || !Number.isFinite(rate)) return null
      const amount = Math.round(hours * rate * 100) / 100
      return amount
    } catch {
      return null
    }
  })()

  useEffect(() => {
    let mounted = true
    const load = async () => {
      try {
        setLoading(true)
        const [rRes, cRes] = await Promise.all([
          roomsAPI.list(),
          customerAPI.getAll({ per_page: 100 }),
        ])
        if (mounted) {
          if (rRes.success) setRooms(rRes.data || [])
          if (cRes.success) setCustomers((cRes as any).data?.items || cRes.data || [])
        }
      } catch (e: any) {
        setError(e?.message || 'Failed to load data')
      } finally {
        setLoading(false)
      }
    }
    load()
    return () => { mounted = false }
  }, [])

  const reloadBookings = async () => {
    try {
      setLoading(true)
      const params: any = {}
      if (filterRoomId) params.room_id = filterRoomId
      if (filterDateFrom) params.from = new Date(filterDateFrom).toISOString()
      if (filterDateTo) params.to = new Date(filterDateTo).toISOString()
      const bRes = await bookingsAPI.list(params)
      if (bRes.success) setBookings(bRes.data || [])
    } catch (e: any) {
      setError(e?.message || 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reloadBookings()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterRoomId, filterDateFrom, filterDateTo])

  const onCreate = handleSubmit(async (values) => {
    setError(null)
    // Basic client validation
    const start_time = new Date(`${values.date}T${values.start}:00`)
    const end_time = new Date(`${values.date}T${values.end}:00`)
    if (!(values.room_id && values.customer_id && values.date && values.start && values.end)) {
      const msg = 'All fields are required'
      setError(msg)
      notify({ kind: 'error', message: msg })
      return
    }
    if (isNaN(start_time.getTime()) || isNaN(end_time.getTime())) {
      const msg = 'Invalid date/time'
      setError(msg)
      notify({ kind: 'error', message: msg })
      return
    }
    if (end_time <= start_time) {
      const msg = 'End time must be after start time'
      setError(msg)
      notify({ kind: 'error', message: msg })
      return
    }
    try {
      const res = await bookingsAPI.create({
        room_id: Number(values.room_id),
        customer_id: Number(values.customer_id),
        start_time: start_time.toISOString(),
        end_time: end_time.toISOString(),
        notes: values.notes,
        total_amount: suggestedAmount ?? undefined,
        status: 'confirmed',
      })
      if (res.success) {
        await reloadBookings()
        reset()
        notify({ kind: 'success', message: 'Booking created' })
      } else {
        const msg = res.message || 'Failed to create booking'
        setError(msg)
        notify({ kind: 'error', message: msg })
      }
    } catch (e: any) {
      const status = e?.response?.status
      const msg = e?.response?.data?.message || e?.message || 'Failed to create booking'
      setError(msg)
      notify({ kind: 'error', message: status === 409 ? 'Booking conflict for the selected time' : msg })
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-1">Manage room bookings and reservations.</p>
        </div>
  <Button variant="secondary" onClick={() => reloadBookings()} className="inline-flex items-center gap-2">
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
              {suggestedAmount != null && (
                <div className="text-sm text-gray-600 -mt-2">
                  Suggested amount: <span className="font-medium">${'{'}suggestedAmount.toFixed(2){'}'}</span>
                  {rooms.find(r=>r.id===Number(watchRoom))?.hourly_rate ? ' (room rate)' : settings?.default_hourly_rate ? ' (default rate)' : ''}
                </div>
              )}
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
          <div className="card-header flex items-center justify-between">
            <h3 className="text-lg font-medium">Upcoming Bookings</h3>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input type="checkbox" className="rounded" checked={hardDelete} onChange={(e) => setHardDelete(e.target.checked)} />
              Hard delete
            </label>
          </div>
          <div className="card-body space-y-4">
            <div className="grid md:grid-cols-4 gap-3">
              <div>
                <label className="form-label">Filter Room</label>
                <Select value={String(filterRoomId)} onChange={(e) => setFilterRoomId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">All rooms</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </Select>
              </div>
              <div>
                <label className="form-label">From</label>
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
              </div>
              <div>
                <label className="form-label">To</label>
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" onClick={() => reloadBookings()} className="w-full">Apply</Button>
              </div>
            </div>
            {bookings.length === 0 ? (
              <div className="text-center text-gray-500 py-8">No bookings yet</div>
            ) : (
              <ul className="divide-y divide-gray-200">
        {bookings.map((b) => {
                  const room = rooms.find((r) => r.id === b.room_id)
                  const customer = customers.find((c) => c.id === b.customer_id)
                  const start = new Date(b.start_time)
                  const end = new Date(b.end_time)
                  const durationHrs = Math.max(0, (end.getTime() - start.getTime()) / 36e5)
                  return (
                    <BookingListItem key={b.id}
                      booking={b}
                      roomName={room?.name}
                      customerName={customer?.name}
                      durationHrs={durationHrs}
                      onUpdated={async () => { await reloadBookings(); notify({ kind: 'success', message: 'Booking updated' }) }}
          onDeleted={async () => { await reloadBookings(); }}
          hardDelete={hardDelete}
                    />
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Simple calendar preview (month grid stub) */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-medium flex items-center gap-2"><CalendarIcon className="h-4 w-4"/> Calendar (preview)</h3>
          <span className="text-sm text-gray-500">Month grid preview</span>
        </div>
        <div className="card-body">
          <BasicMonthCalendar bookings={bookings} onMove={async (bk, isoDate) => {
            try {
              const origStart = new Date(bk.start_time)
              const origEnd = new Date(bk.end_time)
              const duration = origEnd.getTime() - origStart.getTime()
              const target = new Date(`${isoDate}T00:00:00`)
              const newStart = new Date(target)
              newStart.setHours(origStart.getHours(), origStart.getMinutes(), 0, 0)
              const newEnd = new Date(newStart.getTime() + duration)
              const res = await bookingsAPI.update(bk.id, { start_time: newStart.toISOString(), end_time: newEnd.toISOString() })
              if (res.success) {
                await reloadBookings()
                notify({ kind: 'success', message: 'Booking moved' })
              } else {
                notify({ kind: 'error', message: res.message || 'Move failed' })
              }
            } catch (e: any) {
              const status = e?.response?.status
              notify({ kind: 'error', message: status === 409 ? 'Booking conflict for the selected time' : (e?.message || 'Move failed') })
            }
          }} />
        </div>
      </div>
    </div>
  )
}

function BookingListItem({ booking, roomName, customerName, durationHrs, onUpdated, onDeleted, hardDelete }: { booking: Booking; roomName?: string; customerName?: string; durationHrs: number; onUpdated: () => void; onDeleted: () => void; hardDelete: boolean }) {
  const { notify } = useToast()
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState(() => booking.start_time.slice(0,16))
  const [end, setEnd] = useState(() => booking.end_time.slice(0,16))
  const [notes, setNotes] = useState(booking.notes || '')
  const [amount, setAmount] = useState<string>(booking.total_amount != null ? String(booking.total_amount) : '')
  const statusColor = booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'

  const save = async () => {
    try {
      const payload: any = { notes }
      if (start) payload.start_time = new Date(start).toISOString()
      if (end) payload.end_time = new Date(end).toISOString()
      if (amount !== '') {
        const parsed = Number(amount)
        if (!Number.isFinite(parsed) || parsed < 0) {
          notify({ kind: 'error', message: 'Invalid amount' })
          return
        }
        payload.total_amount = parsed
      }
      const res = await bookingsAPI.update(booking.id, payload)
      if (res.success) { setEditing(false); onUpdated() }
      else notify({ kind: 'error', message: res.message || 'Update failed' })
    } catch (e: any) {
      const status = e?.response?.status
      notify({ kind: 'error', message: status === 409 ? 'Booking conflict for the selected time' : (e?.message || 'Update failed') })
    }
  }

  const cancelOrDelete = async () => {
    try {
      if (hardDelete) {
        const res = await bookingsAPI.remove(booking.id)
        if (res.success) onDeleted()
        else notify({ kind: 'error', message: res.message || 'Delete failed' })
      } else {
        const res = await bookingsAPI.update(booking.id, { status: 'cancelled' })
        if (res.success) onDeleted()
        else notify({ kind: 'error', message: res.message || 'Cancel failed' })
      }
    } catch (e: any) {
      notify({ kind: 'error', message: e?.message || (hardDelete ? 'Delete failed' : 'Cancel failed') })
    }
  }

  const price = booking.total_amount ?? undefined
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{roomName || `Room #${booking.room_id}`} · {customerName || `Customer #${booking.customer_id}`}</div>
          <div className="text-sm text-gray-600">
            {new Date(booking.start_time).toLocaleString()} – {new Date(booking.end_time).toLocaleTimeString()} · {durationHrs.toFixed(1)}h{price != null ? ` · $${price}` : ''}
          </div>
          {editing ? (
            <div className="mt-2 grid md:grid-cols-4 gap-2">
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              <Input type="number" step="0.01" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          ) : booking.notes ? (
            <div className="text-sm text-gray-700 mt-1">{booking.notes}</div>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${statusColor}`}>{booking.status}</span>
          {editing ? (
            <>
              <Button variant="secondary" onClick={() => { setEditing(false); setStart(booking.start_time.slice(0,16)); setEnd(booking.end_time.slice(0,16)); setNotes(booking.notes || '') }} className="p-2"><XIcon className="h-4 w-4"/></Button>
              <Button onClick={save} className="p-2"><Check className="h-4 w-4"/></Button>
            </>
          ) : (
            <>
              {booking.status !== 'cancelled' && <Button variant="secondary" onClick={() => setEditing(true)} className="p-2"><Edit className="h-4 w-4"/></Button>}
              {booking.status !== 'cancelled' && <Button variant="secondary" onClick={cancelOrDelete} className="p-2"><Trash2 className="h-4 w-4"/></Button>}
            </>
          )}
        </div>
      </div>
    </li>
  )
}

function BasicMonthCalendar({ bookings, onMove }: { bookings: Booking[]; onMove: (booking: Booking, isoDate: string) => void | Promise<void> }) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const first = new Date(year, month, 1)
  const startDay = first.getDay() // 0-6
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = [] as Array<{ date: Date; bookings: Booking[] } | null>
  for (let i = 0; i < startDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d)
    const isoDay = date.toISOString().slice(0, 10)
    const dayBookings = bookings.filter(b => b.start_time.slice(0, 10) === isoDay)
    cells.push({ date, bookings: dayBookings })
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return (
    <div className="grid grid-cols-7 gap-2">
      {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
        <div key={d} className="text-xs font-medium text-gray-500 text-center">{d}</div>
      ))}
      {cells.map((c, idx) => (
        <div
          key={idx}
          className="min-h-[96px] border rounded-lg p-2 bg-white"
          onDragOver={(e) => { if (c) { e.preventDefault() } }}
          onDrop={(e) => {
            if (!c) return
            e.preventDefault()
            const data = e.dataTransfer.getData('application/x-booking-id') || e.dataTransfer.getData('text/plain')
            const id = Number(data)
            if (!Number.isFinite(id)) return
            const bk = bookings.find(b => b.id === id)
            if (!bk) return
            const isoDay = c.date.toISOString().slice(0, 10)
            onMove(bk, isoDay)
          }}
        >
          {c && (
            <>
              <div className="text-xs font-medium text-gray-700">{c.date.getDate()}</div>
              <div className="mt-1 space-y-1">
                {c.bookings.slice(0, 3).map((b) => (
                  <div
                    key={b.id}
                    draggable
                    onDragStart={(e) => { e.dataTransfer.setData('application/x-booking-id', String(b.id)) }}
                    className="text-[11px] px-2 py-1 rounded bg-primary-50 text-primary-700 truncate cursor-move"
                  >
                    {new Date(b.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · R{b.room_id}
                  </div>
                ))}
                {c.bookings.length > 3 && (
                  <div className="text-[11px] text-gray-500">+{c.bookings.length - 3} more</div>
                )}
              </div>
            </>
          )}
        </div>
      ))}
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
  } catch {
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