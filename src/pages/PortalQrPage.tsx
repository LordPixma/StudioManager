import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

export default function PortalQrPage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState<string>('')
  useEffect(() => {
    const c = params.get('code')
    if (c) setCode(c)
  }, [params])
  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <div className="bg-white rounded shadow p-6 text-center space-y-4">
        <h1 className="text-xl font-semibold">Check-in Code</h1>
        <div className="text-3xl tracking-widest font-mono">{code || '------'}</div>
        <div className="text-sm text-gray-600">Show this code to staff to check in.</div>
      </div>
    </div>
  )
}
