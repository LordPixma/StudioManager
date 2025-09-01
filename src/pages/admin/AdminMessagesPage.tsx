import { useEffect, useState } from 'react'
import { adminAPI } from '../../lib/api'
import { Input } from '../../components/ui/Input'
import { Textarea } from '../../components/ui/Textarea'
import { Button } from '../../components/ui/Button'

export function AdminMessagesPage() {
  const [messages, setMessages] = useState<any[]>([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [tenantId, setTenantId] = useState('')

  const load = async () => {
    const res = await adminAPI.messagesList()
    if (res.success) setMessages(res.data || [])
  }

  useEffect(() => { load() }, [])

  const send = async () => {
    const payload: any = { title, body }
    if (tenantId) payload.tenant_id = parseInt(tenantId, 10)
    const res = await adminAPI.messagesCreate(payload)
    if (res.success) {
      setTitle(''); setBody(''); setTenantId('');
      load()
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Broadcast Messages</h1>
        <p className="text-gray-600 dark:text-gray-300 mt-1">Send announcements globally or to a specific tenant.</p>
      </div>
      <div className="card">
        <div className="card-body grid sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3"><label className="form-label">Title</label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="sm:col-span-3"><label className="form-label">Body</label><Textarea value={body} onChange={(e) => setBody(e.target.value)} /></div>
          <div><label className="form-label">Tenant ID (optional)</label><Input value={tenantId} onChange={(e) => setTenantId(e.target.value)} placeholder="Target tenant" /></div>
          <div className="sm:col-span-3"><Button onClick={send}>Send</Button></div>
        </div>
      </div>
      <div className="card">
        <div className="card-header"><h3 className="font-medium">Recent Announcements</h3></div>
        <div className="card-body">
          <ul className="space-y-3">
            {messages.map(m => (
              <li key={m.id} className="p-3 rounded border border-gray-200 dark:border-gray-800">
                <div className="font-medium">{m.title}</div>
                <div className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{m.body}</div>
                <div className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
