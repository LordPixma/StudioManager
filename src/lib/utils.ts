export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

// Trigger a browser download for a given Blob
export function downloadBlobAsFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Safe extraction of an error message from unknown error-like values
export function getErrorMessage(err: unknown, fallback = 'Unexpected error'): string {
  if (typeof err === 'string') return err
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>
    // Axios-style: err.response?.data?.message
    const response = obj['response']
    if (response && typeof response === 'object') {
      const data = (response as Record<string, unknown>)['data']
      if (data && typeof data === 'object') {
        const msg = (data as Record<string, unknown>)['message']
        if (typeof msg === 'string') return msg
      }
    }
    const msg = obj['message']
    if (typeof msg === 'string') return msg
  }
  return fallback
}
