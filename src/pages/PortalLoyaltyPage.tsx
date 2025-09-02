import { useEffect, useState } from 'react'
import { portalAPI } from '../lib/api'

export default function PortalLoyaltyPage() {
  const [points, setPoints] = useState(0)
  const [tx, setTx] = useState<any[]>([])
  const [code, setCode] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    portalAPI.loyalty().then(res => {
      if (res.success) { setPoints((res.data as any).points || 0); setTx((res.data as any).transactions || []) }
    })
  }, [])

  async function applyReferral(e: React.FormEvent) {
    e.preventDefault(); setMsg('')
    const res = await portalAPI.applyReferral(code)
    setMsg(res.success ? 'Referral applied' : (res.message || 'Failed'))
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">Loyalty</h1>
      <div className="bg-white p-3 rounded shadow">Points: <span className="font-semibold">{points}</span></div>
      <form onSubmit={applyReferral} className="flex gap-2">
        <input className="border rounded p-2 flex-1" placeholder="Referral code" value={code} onChange={e=>setCode(e.target.value)} />
        <button className="btn btn-primary" type="submit">Apply</button>
      </form>
      {msg && <div className="text-sm text-gray-700">{msg}</div>}
      <div className="space-y-1">
        {tx.map(t => (
          <div key={t.id} className="text-sm bg-white p-2 rounded shadow flex justify-between">
            <div>{new Date(t.created_at).toLocaleString()} · {t.type} {t.reason ? `(${t.reason})` : ''}</div>
            <div className={t.type==='earn' ? 'text-green-700' : 'text-red-700'}>{t.type==='earn' ? '+' : '-'}{t.points}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
