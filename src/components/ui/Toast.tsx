import React, { useCallback, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { ToastContext, ToastInput } from './ToastContext'

type Toast = { id: number } & ToastInput

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([])

  const notify = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random()
    const toast: Toast = { id, ...t }
    setToasts((prev) => [...prev, toast])
    const timeout = t.timeout ?? 3500
    if (timeout > 0) {
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), timeout)
    }
  }, [])

  const value = useMemo(() => ({ notify }), [notify])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed z-50 top-4 right-4 space-y-3">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              'min-w-[260px] max-w-sm rounded-xl border shadow-lg p-4 bg-white flex items-start gap-3 ' +
              (t.kind === 'success'
                ? 'border-green-200'
                : t.kind === 'error'
                ? 'border-red-200'
                : 'border-gray-200')
            }
          >
            <div className={
              'h-2 w-2 mt-2 rounded-full ' +
              (t.kind === 'success' ? 'bg-green-500' : t.kind === 'error' ? 'bg-red-500' : 'bg-gray-400')
            } />
            <div className="flex-1">
              {t.title && <div className="text-sm font-semibold text-gray-900">{t.title}</div>}
              <div className="text-sm text-gray-700">{t.message}</div>
            </div>
            <button className="p-1 rounded hover:bg-gray-100" onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}>
              <X className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

