import { createContext } from 'react'

export type ToastKind = 'success' | 'error' | 'info'
export type ToastInput = { title?: string; message: string; kind?: ToastKind; timeout?: number }

export const ToastContext = createContext<{ notify: (t: ToastInput) => void } | null>(null)
