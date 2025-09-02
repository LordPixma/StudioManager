import { useEffect, useState } from 'react'
import { portalAPI, roomsAPI } from '../lib/api'

export default function PortalBookingsPage() {
  const [customer, setCustomer] = useState<{ id:number; name:string; email:string; loyalty_points:number }|null>(null)
  const [bookings, setBookings] = useState<any[]>([])
  const [rooms, setRooms] = useState<any[]>([])
  const [roomId, setRoomId] = useState<number|''>('' as any)
  const [date, setDate] = useState<string>('')
  const [start, setStart] = useState<string>('')
  const [end, setEnd] = useState<string>('')
  const [msg, setMsg] = useState<string>('')

  useEffect(() => {
    portalAPI.session().then(res => { if (res.success) setCustomer(res.data!.customer as any) })
    roomsAPI.list().then(res => { if (res.success) setRooms(res.data as any[]) })
    portalAPI.listBookings().then(res => { if (res.success) setBookings(res.data as any[]) })
  }, [])

  async function createBooking(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    if (!roomId || !date || !start || !end) return
    const startIso = new Date(`${date}T${start}:00`).toISOString()
    const endIso = new Date(`${date}T${end}:00`).toISOString()
    const res = await portalAPI.createBooking({ room_id: Number(roomId), start_time: startIso, end_time: endIso })
    if (res.success) {
      setBookings(prev => [...prev, res.data])
      setMsg('Booking created')
    } else setMsg(res.message || 'Failed')
  }

  async function cancel(id: number) {
    const res = await portalAPI.cancelBooking(id)
    if (res.success) setBookings(prev => prev.filter(b => b.id !== id))
  }

  async function showQr(id: number) {
    const res = await portalAPI.getQrCode(id)
    if (res.success) {
      const code = res.data!.code
      alert(`Show this code at check-in: ${code}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My Bookings</h1>
        <div className="text-sm">{customer?.name} · Points: <span className="font-semibold">{customer?.loyalty_points ?? 0}</span></div>
      </div>

      <form onSubmit={createBooking} className="grid grid-cols-2 gap-3 bg-white p-3 rounded shadow">
        <select className="border p-2 rounded col-span-2" value={roomId} onChange={e=>setRoomId(Number(e.target.value))}>
          <option value="">Select a room</option>
          {rooms.map(r => (<option key={r.id} value={r.id}>{r.name}</option>))}
        </select>
        <input className="border p-2 rounded" type="date" value={date} onChange={e=>setDate(e.target.value)} />
        <div className="flex gap-2">
          <input className="border p-2 rounded w-full" type="time" value={start} onChange={e=>setStart(e.target.value)} />
          <input className="border p-2 rounded w-full" type="time" value={end} onChange={e=>setEnd(e.target.value)} />
        </div>
        <button className="btn btn-primary col-span-2" type="submit">Book</button>
        {msg && <div className="text-sm text-green-600 col-span-2">{msg}</div>}
      </form>

      <div className="space-y-2">
        {bookings.map(b => (
          <div key={b.id} className="bg-white p-3 rounded shadow flex items-center justify-between">
            <div>
              <div className="font-medium">{new Date(b.start_time).toLocaleString()} → {new Date(b.end_time).toLocaleTimeString()}</div>
              <div className="text-xs text-gray-600">Status: {b.status}</div>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={()=>showQr(b.id)}>QR Code</button>
              <button className="btn btn-danger" onClick={()=>cancel(b.id)}>Cancel</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
