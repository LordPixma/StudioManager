import { useState } from 'react'
import { portalAPI } from '../lib/api'

export default function PortalLoginPage() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'request'|'verify'>('request')
  const [message, setMessage] = useState<string>('')
  const [error, setError] = useState<string>('')

  async function requestCode(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setMessage('')
    const res = await portalAPI.requestOtp(email)
    if (res.success) { setMessage('Check your email for a 6-digit code.'); setStep('verify') }
    else setError(res.message || 'Failed to request code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setMessage('')
    const res = await portalAPI.verifyOtp(email, code)
    if (res.success) { setMessage('Logged in. You can close this window and open the customer portal.'); }
    else setError(res.message || 'Invalid code')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white shadow rounded p-6 space-y-4">
        <h1 className="text-xl font-semibold">Customer Sign In</h1>
        {step === 'request' && (
          <form onSubmit={requestCode} className="space-y-3">
            <label className="block text-sm">Email</label>
            <input className="w-full border rounded p-2" type="email" value={email} onChange={e=>setEmail(e.target.value)} required />
            <button className="btn btn-primary w-full" type="submit">Send code</button>
          </form>
        )}
        {step === 'verify' && (
          <form onSubmit={verify} className="space-y-3">
            <div className="text-sm text-gray-600">Code sent to {email}</div>
            <label className="block text-sm">6-digit Code</label>
            <input className="w-full border rounded p-2" inputMode="numeric" pattern="[0-9]{6}" value={code} onChange={e=>setCode(e.target.value)} required />
            <button className="btn btn-primary w-full" type="submit">Verify</button>
            <button className="btn w-full" type="button" onClick={()=>setStep('request')}>Back</button>
          </form>
        )}
        {message && <div className="text-green-600 text-sm">{message}</div>}
        {error && <div className="text-red-600 text-sm">{error}</div>}
      </div>
    </div>
  )
}
