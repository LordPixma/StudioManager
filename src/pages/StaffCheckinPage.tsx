import { useState } from 'react'
import { checkinsAPI } from '../lib/api'

export default function StaffCheckinPage() {
  const [code, setCode] = useState('')
  const [result, setResult] = useState<string>('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setResult('')
    const res = await checkinsAPI.scan(code)
    if (res.success) setResult(`Checked in booking #${(res.data as any).booking_id}`)
    else setResult(res.message || 'Failed')
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Scan Check-in</h1>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input className="border rounded p-2 w-full" placeholder="Enter code" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} />
        <button className="btn btn-primary w-full" type="submit">Check in</button>
      </form>
      {result && <div className="text-sm text-gray-700">{result}</div>}
    </div>
  )
}
