import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventDropArg } from '@fullcalendar/core' 
type EventResizeDoneArg = {
  event: { id: string; start: Date | null; end: Date | null }
  revert: () => void
}
import { useEffect, useMemo, useState } from 'react'
import { bookingsAPI, roomsAPI, customerAPI } from '../lib/api'
import type { Booking, Room, Customer } from '../types'
import { useToast } from '../components/ui/useToast'
import { Button } from '../components/ui/Button'

export function CalendarPage() {
  const { notify } = useToast()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [rooms, setRooms] = useState<Room[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [viewRange, setViewRange] = useState<{ start: string; end: string } | null>(null)

  const loadData = async () => {
    const [rRes, cRes] = await Promise.all([roomsAPI.list(), customerAPI.getAll({ per_page: 200 })])
    if (rRes.success) setRooms(Array.isArray(rRes.data) ? (rRes.data as Room[]) : [])
    if (cRes && (cRes as any).success) {
      const items = (cRes as any).data?.items || cRes.data
      if (Array.isArray(items)) setCustomers(items as Customer[])
    }
  }

  const reloadBookings = async () => {
    const params: any = {}
    if (viewRange) { params.from = viewRange.start; params.to = viewRange.end }
    const r = await bookingsAPI.list(params)
    if (r.success) setBookings(Array.isArray(r.data) ? (r.data as Booking[]) : [])
  }

  useEffect(() => { loadData() }, [])
  useEffect(() => { reloadBookings() }, [viewRange?.start, viewRange?.end])

  const events = useMemo(() => bookings.map(b => ({
    id: String(b.id),
    start: b.start_time,
    end: b.end_time,
    title: (() => {
      const room = rooms.find(r => r.id === b.room_id)?.name || 'Room'
      const cust = customers.find(c => c.id === b.customer_id)?.name || 'Customer'
      return `${room} — ${cust}`
    })(),
    extendedProps: { booking: b },
  })), [bookings, rooms, customers])

  const onEventDrop = async (arg: EventDropArg) => {
    const id = Number(arg.event.id)
    const start = arg.event.start?.toISOString()
    const end = arg.event.end?.toISOString()
    if (!start || !end) { arg.revert(); return }
    const res = await bookingsAPI.update(id, { start_time: start, end_time: end })
    if (!res.success) { arg.revert(); notify({ kind: 'error', message: res.message || 'Update failed' }) } else { notify({ kind: 'success', message: 'Booking updated' }); reloadBookings() }
  }
  const onEventResize = async (arg: EventResizeDoneArg) => {
    const id = Number(arg.event.id)
    const start = arg.event.start?.toISOString()
    const end = arg.event.end?.toISOString()
    if (!start || !end) { arg.revert(); return }
    const res = await bookingsAPI.update(id, { start_time: start, end_time: end })
    if (!res.success) { arg.revert(); notify({ kind: 'error', message: res.message || 'Update failed' }) } else { notify({ kind: 'success', message: 'Booking updated' }); reloadBookings() }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <Button variant="secondary" onClick={() => reloadBookings()}>Refresh</Button>
      </div>
      <div className="card">
        <div className="card-body p-2">
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }}
            editable
            selectable={false}
            events={events}
            eventDrop={onEventDrop}
            eventResize={onEventResize}
            datesSet={(info) => setViewRange({ start: info.startStr, end: info.endStr })}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            height="auto"
          />
        </div>
      </div>
    </div>
  )
}

export default CalendarPage
