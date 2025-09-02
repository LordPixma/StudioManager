import { FileX, Plus, RefreshCw, Download, Edit, Trash2, Check, X as XIcon, Calendar as CalendarIcon, TrendingUp, DollarSign, Users as UsersIcon, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { bookingsAPI, customerAPI, roomsAPI, staffAPI, reportsAPI, analyticsAPI } from '../lib/api'
import type { Booking, Room, Customer } from '../types'

// Lightweight local types to eliminate any
type StaffOption = { id: number; name: string }
type SummaryResponse = {
  revenue?: number
  total_bookings?: number
  avg_booking_value?: number
  unique_customers?: number
  occupancy_rate?: number
  peak_hour?: number
  peak_day_of_week?: number
}
type ForecastPoint = { period: string; value: number | string }
type ForecastResponse = { method?: string; history?: ForecastPoint[]; forecasts?: ForecastPoint[] }
type OccupancyRoom = { room_id: number; room_name?: string; utilization?: number }
type OccupancyResponse = { per_room?: OccupancyRoom[]; assumptions?: { open_hours_per_day?: number; days?: number } }
type StaffPerformanceRow = { staff_id: number; staff_name: string; bookings: number; revenue: number }

function getHttpStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: unknown }).response
    if (resp && typeof resp === 'object' && 'status' in resp) {
      const s = (resp as { status?: unknown }).status
      if (typeof s === 'number') return s
    }
  }
  return undefined
}
function getHttpMessage(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'response' in err) {
    const resp = (err as { response?: unknown }).response
    if (resp && typeof resp === 'object' && 'data' in resp) {
      const data = (resp as { data?: unknown }).data
      if (data && typeof data === 'object' && 'message' in data) {
        const m = (data as { message?: unknown }).message
        if (typeof m === 'string') return m
      }
    }
  }
  return undefined
}
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
  const [staffList, setStaffList] = useState<StaffOption[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterRoomId, setFilterRoomId] = useState<number | ''>('')
  const [filterDateFrom, setFilterDateFrom] = useState<string>('')
  const [filterDateTo, setFilterDateTo] = useState<string>('')
  const [hardDelete, setHardDelete] = useState<boolean>(false)

  const { register, handleSubmit, reset, watch } = useForm<{ room_id: number; customer_id: number; staff_id?: number | ''; date: string; start: string; end: string; notes?: string }>()
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
        const [rRes, cRes, sRes] = await Promise.all([
          roomsAPI.list(),
          customerAPI.getAll({ per_page: 100 }),
          staffAPI.list(),
        ])
        if (mounted) {
          if (rRes.success) setRooms(Array.isArray(rRes.data) ? (rRes.data as Room[]) : [])
          if (cRes.success) {
            const raw = cRes.data as unknown
            if (Array.isArray(raw)) setCustomers(raw as Customer[])
            else {
              const items = (raw as { items?: unknown })?.items
              setCustomers(Array.isArray(items) ? (items as Customer[]) : [])
            }
          }
          if (sRes.success) {
            const raw = sRes.data as unknown
            const list: StaffOption[] = Array.isArray(raw)
              ? raw.map((e: unknown) => {
                  const o = e as { id?: unknown; name?: unknown; email?: unknown }
                  const idVal = typeof o.id === 'number' ? o.id : Number(o.id)
                  const nm = typeof o.name === 'string' ? o.name : (typeof o.email === 'string' ? o.email : `Staff ${idVal}`)
                  return { id: Number.isFinite(idVal) ? (idVal as number) : 0, name: nm }
                })
              : []
            setStaffList(list)
          }
        }
      } catch (e: unknown) {
        const msg = (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string')
          ? (e as { message: string }).message
          : 'Failed to load data'
        setError(msg)
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
      const params: { room_id?: number; from?: string; to?: string } = {}
      if (filterRoomId) params.room_id = filterRoomId
      if (filterDateFrom) params.from = new Date(filterDateFrom).toISOString()
      if (filterDateTo) params.to = new Date(filterDateTo).toISOString()
      const bRes = await bookingsAPI.list(params)
      if (bRes.success) setBookings(Array.isArray(bRes.data) ? (bRes.data as Booking[]) : [])
    } catch (e: unknown) {
      const msg = (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string')
        ? (e as { message: string }).message
        : 'Failed to load bookings'
      setError(msg)
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
        staff_id: values.staff_id ? Number(values.staff_id) : null,
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
    } catch (e: unknown) {
      const status = getHttpStatus(e)
      const msg = getHttpMessage(e) || (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string' ? (e as { message: string }).message : 'Failed to create booking')
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
              {/* Staff selection */}
              <div>
                <label className="form-label">Assign Staff (optional)</label>
                <Select {...register('staff_id')}>
                  <option value="">Unassigned</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
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
                      staffList={staffList as any}
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

function BookingListItem({ booking, roomName, customerName, durationHrs, onUpdated, onDeleted, hardDelete, staffList }: { booking: Booking; roomName?: string; customerName?: string; durationHrs: number; onUpdated: () => void; onDeleted: () => void; hardDelete: boolean; staffList: StaffOption[] }) {
  const { notify } = useToast()
  const [editing, setEditing] = useState(false)
  const [start, setStart] = useState(() => booking.start_time.slice(0,16))
  const [end, setEnd] = useState(() => booking.end_time.slice(0,16))
  const [notes, setNotes] = useState(booking.notes || '')
  const [amount, setAmount] = useState<string>(booking.total_amount != null ? String(booking.total_amount) : '')
  const [staffId, setStaffId] = useState<string>(booking.staff_id != null ? String(booking.staff_id) : '')
  const statusColor = booking.status === 'confirmed' ? 'bg-green-100 text-green-800' : booking.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'

  const save = async () => {
    try {
      const payload: Partial<{ start_time: string; end_time: string; status: 'confirmed' | 'cancelled'; notes: string; total_amount: number; staff_id: number | null }> = { notes }
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
      payload.staff_id = staffId ? Number(staffId) : null
      const res = await bookingsAPI.update(booking.id, payload)
      if (res.success) { setEditing(false); onUpdated() }
      else notify({ kind: 'error', message: res.message || 'Update failed' })
    } catch (e: unknown) {
      const status = getHttpStatus(e)
      const msg = getHttpMessage(e) || (e && typeof e === 'object' && 'message' in e && typeof (e as { message?: unknown }).message === 'string' ? (e as { message: string }).message : 'Update failed')
      notify({ kind: 'error', message: status === 409 ? 'Booking conflict for the selected time' : msg })
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
  const assignedStaff = booking.staff_id != null ? staffList.find(s => s.id === booking.staff_id) : undefined
  return (
    <li className="py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium truncate">{roomName || `Room #${booking.room_id}`} · {customerName || `Customer #${booking.customer_id}`}</div>
          <div className="text-sm text-gray-600">
            {new Date(booking.start_time).toLocaleString()} – {new Date(booking.end_time).toLocaleTimeString()} · {durationHrs.toFixed(1)}h{price != null ? ` · $${price}` : ''}{assignedStaff ? ` · Staff: ${assignedStaff.name}` : ''}
          </div>
          {editing ? (
            <div className="mt-2 grid md:grid-cols-5 gap-2">
              <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
              <Input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
              <Input type="number" step="0.01" placeholder="Amount ($)" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div>
            <label className="form-label">Staff</label>
            <Select value={staffId} onChange={(e) => setStaffId(e.target.value)}>
              <option value="">Unassigned</option>
              {Array.isArray(staffList) && staffList.map((s) => (
                <option key={s.id} value={String(s.id)}>{s.name}</option>
              ))}
            </Select>
          </div>
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
  if (mounted && res.success) setStaff(Array.isArray(res.data) ? res.data : [])
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
  if (list.success) setStaff(Array.isArray(list.data) ? list.data : [])
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
  const [from, setFrom] = useState<string>(() => new Date(Date.now() - 29*24*3600*1000).toISOString().slice(0,10))
  const [to, setTo] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [openHours, setOpenHours] = useState<number>(12)
  const [loading, setLoading] = useState(false)
  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [forecast, setForecast] = useState<ForecastResponse | null>(null)
  const [cust, setCust] = useState<{ retention_rate?: number; churn_rate?: number; avg_clv?: number } | null>(null)
  const [occ, setOcc] = useState<OccupancyResponse | null>(null)
  const [staff, setStaff] = useState<{ staff?: StaffPerformanceRow[] } | null>(null)
  const { notify } = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const fromIso = new Date(from).toISOString()
      const toIso = new Date(new Date(to).setHours(23,59,59,999)).toISOString()
      const [s, f, c, o, st] = await Promise.all([
        analyticsAPI.summary({ from: fromIso, to: toIso, open_hours_per_day: openHours }),
        analyticsAPI.forecast({ metric: 'revenue', period: 'monthly', months: 3 }),
        analyticsAPI.customers({ from: fromIso, to: toIso }),
        analyticsAPI.occupancy({ from: fromIso, to: toIso, open_hours_per_day: openHours }),
        analyticsAPI.staff({ from: fromIso, to: toIso }),
      ])
  if (s.success) setSummary((s.data as unknown) as SummaryResponse)
  if (f.success) setForecast((f.data as unknown) as ForecastResponse)
  if (c.success) setCust((c.data as unknown) as { retention_rate?: number; churn_rate?: number; avg_clv?: number })
  if (o.success) setOcc((o.data as unknown) as OccupancyResponse)
  if (st.success) setStaff((st.data as unknown) as { staff?: StaffPerformanceRow[] })
    } catch (e) {
      console.error(e)
      notify({ kind: 'error', message: 'Failed to load analytics' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const kpi = (label: string, value: string | number, icon: React.ReactNode) => (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
      <div className="p-2 rounded-lg bg-primary-50 text-primary-600">{icon}</div>
      <div>
        <div className="text-sm text-gray-500">{label}</div>
        <div className="text-xl font-semibold">{value}</div>
      </div>
    </div>
  )

  // Minimal SVG sparkline; values array plotted left-to-right with optional split index for history vs forecast
  const Sparkline = ({ values, width = 320, height = 60, splitIndex }: { values: number[]; width?: number; height?: number; splitIndex?: number }) => {
    if (!values || values.length === 0) return null
    const min = Math.min(...values)
    const max = Math.max(...values)
    const pad = 4
    const w = width
    const h = height
    const range = max - min || 1
    const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0
    const y = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2)
    const points = values.map((v, i) => `${pad + i * step},${y(v)}`).join(' ')
    // Split into history and forecast paths
    let historyPts = points
    let forecastPts = ''
    if (typeof splitIndex === 'number' && splitIndex >= 1 && splitIndex < values.length) {
      const pts = points.split(' ')
      historyPts = pts.slice(0, splitIndex).join(' ')
      forecastPts = pts.slice(splitIndex - 1).join(' ')
    }
    return (
      <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} className="w-full">
        {/* history */}
        <polyline fill="none" stroke="#3b82f6" strokeWidth="2" points={historyPts} />
        {/* forecast */}
        {forecastPts && <polyline fill="none" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth="2" points={forecastPts} />}
      </svg>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-1">KPI tracking, forecasts, customer insights, and utilization.</p>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-gray-500">to</span>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <Input type="number" min={1} max={24} value={openHours} onChange={(e)=>setOpenHours(Number(e.target.value)||12)} className="w-24" placeholder="Open hrs" />
          <Button variant="secondary" onClick={load} disabled={loading}><RefreshCw className="h-4 w-4"/></Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid md:grid-cols-4 gap-4">
        {kpi('Revenue', `$${Number(summary?.revenue||0).toFixed(2)}`, <DollarSign className="h-5 w-5"/>)}
        {kpi('Bookings', Number(summary?.total_bookings||0), <TrendingUp className="h-5 w-5"/>)}
        {kpi('Avg. booking value', `$${Number(summary?.avg_booking_value||0).toFixed(2)}`, <DollarSign className="h-5 w-5"/>)}
        {kpi('Unique customers', Number(summary?.unique_customers||0), <UsersIcon className="h-5 w-5"/>)}
      </div>

      {/* Forecast & occupancy */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Revenue Forecast (next 3 mo)</h3></div>
          <div className="card-body space-y-3">
            <div className="text-sm text-gray-600">Method: {forecast?.method ? forecast.method.replace(/_/g, ' ') : ''}</div>
            {/* Sparkline based on history + forecasts */}
            {(() => {
              const historyVals = Array.isArray(forecast?.history) ? forecast!.history.map((h: any) => Number(h.value) || 0) : []
              const forecastVals = Array.isArray(forecast?.forecasts) ? forecast!.forecasts.map((f: any) => Number(f.value) || 0) : []
              const all = [...historyVals, ...forecastVals]
              return all.length > 0 ? (
                <Sparkline values={all} splitIndex={historyVals.length} />
              ) : null
            })()}
            <ul className="text-sm space-y-1">
              {forecast?.forecasts?.map((f: any) => (
                <li key={f.period} className="flex justify-between"><span>{f.period}</span><span className="font-medium">${Number(f.value).toFixed(2)}</span></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Occupancy</h3></div>
          <div className="card-body space-y-3">
            <div className="flex items-center gap-2 text-sm text-gray-600"><Clock className="h-4 w-4"/> Assumed open hours/day: {occ?.assumptions?.open_hours_per_day} · Days: {occ?.assumptions?.days}</div>
            <div className="space-y-2">
              {occ?.per_room?.map((r: any) => (
                <div key={r.room_id}>
                  <div className="flex justify-between text-sm"><span>{r.room_name || `Room ${r.room_id}`}</span><span>{Math.round((r.utilization||0)*100)}%</span></div>
                  <div className="w-full h-2 bg-gray-100 rounded"><div className="h-2 bg-primary-500 rounded" style={{ width: `${Math.min(100, Math.round((r.utilization||0)*100))}%` }} /></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Customer analytics and peak times */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Customers</h3></div>
          <div className="card-body text-sm space-y-2">
            <div>Retention rate: <span className="font-medium">{Math.round((cust?.retention_rate||0)*100)}%</span></div>
            <div>Churn rate: <span className="font-medium">{Math.round((cust?.churn_rate||0)*100)}%</span></div>
            <div>Avg CLV (last 180d): <span className="font-medium">${Number(cust?.avg_clv||0).toFixed(2)}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="text-lg font-medium">Peak Times</h3></div>
          <div className="card-body text-sm space-y-2">
            <div>Peak hour: <span className="font-medium">{summary?.peak_hour ?? '—'}</span></div>
            <div>Peak weekday (0=Sun): <span className="font-medium">{summary?.peak_day_of_week ?? '—'}</span></div>
            <div>Occupancy rate (overall): <span className="font-medium">{Math.round((summary?.occupancy_rate||0)*100)}%</span></div>
          </div>
        </div>
      </div>

      {/* Staff performance */}
      <div className="card">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-lg font-medium">Staff Performance</h3>
          <span className="text-xs text-gray-500">Requires assigning bookings to staff</span>
        </div>
        <div className="card-body">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-4">Staff</th>
                  <th className="py-2 pr-4">Bookings</th>
                  <th className="py-2 pr-4">Revenue</th>
                </tr>
              </thead>
              <tbody>
                {staff?.staff?.map((s: any) => (
                  <tr key={s.staff_id} className="border-t">
                    <td className="py-2 pr-4">{s.staff_name}</td>
                    <td className="py-2 pr-4">{s.bookings}</td>
                    <td className="py-2 pr-4">${Number(s.revenue||0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CSV downloads */}
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