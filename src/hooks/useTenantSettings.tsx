import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { tenantsAPI } from '../lib/api'
import { useAuth } from './useAuth'
import type { Tenant } from '../types'

type TenantSettings = Record<string, any>

interface TenantSettingsContextType {
  tenant: Tenant | null
  settings: TenantSettings
  isLoading: boolean
  refresh: () => Promise<void>
}

const TenantSettingsContext = createContext<TenantSettingsContextType | null>(null)

export function useTenantSettings() {
  const ctx = useContext(TenantSettingsContext)
  if (!ctx) throw new Error('useTenantSettings must be used within TenantSettingsProvider')
  return ctx
}

function clamp(n: number, min = 0, max = 100) { return Math.min(max, Math.max(min, n)) }

function hexToHsl(hex: string) {
  const s = hex.replace('#','')
  const bigint = parseInt(s.length === 3 ? s.split('').map(c=>c+c).join('') : s, 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  const r1 = r/255, g1 = g/255, b1 = b/255
  const max = Math.max(r1,g1,b1), min = Math.min(r1,g1,b1)
  let h = 0, s1 = 0
  const l = (max + min) / 2
  const d = max - min
  if (d !== 0) {
    s1 = d / (1 - Math.abs(2*l - 1))
    switch (max) {
      case r1: h = 60 * (((g1 - b1) / d) % 6); break
      case g1: h = 60 * (((b1 - r1) / d) + 2); break
      case b1: h = 60 * (((r1 - g1) / d) + 4); break
    }
  }
  if (h < 0) h += 360
  return { h, s: s1 * 100, l: l * 100 }
}

function hslToHex(h: number, s: number, l: number) {
  h = (h%360+360)%360; s = clamp(s)/100; l = clamp(l)/100
  const c = (1 - Math.abs(2*l - 1)) * s
  const x = c * (1 - Math.abs(((h/60) % 2) - 1))
  const m = l - c/2
  let r=0,g=0,b=0
  if (0<=h && h<60){ r=c; g=x; b=0 }
  else if (60<=h && h<120){ r=x; g=c; b=0 }
  else if (120<=h && h<180){ r=0; g=c; b=x }
  else if (180<=h && h<240){ r=0; g=x; b=c }
  else if (240<=h && h<300){ r=x; g=0; b=c }
  else { r=c; g=0; b=x }
  const toHex = (v: number) => {
    const n = Math.round((v + m) * 255)
    return n.toString(16).padStart(2, '0')
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function derivePalette(baseHex: string) {
  let hex = baseHex
  if (!/^#?[0-9a-fA-F]{3,6}$/.test(hex)) hex = '#0ea5e9' // fallback
  if (!hex.startsWith('#')) hex = `#${hex}`
  const { h, s, l } = hexToHsl(hex)
  // Simple scale around base lightness
  const p = {
    50:  hslToHex(h, s*0.35, clamp(l + 46)),
    100: hslToHex(h, s*0.45, clamp(l + 36)),
    200: hslToHex(h, s*0.55, clamp(l + 26)),
    300: hslToHex(h, s*0.65, clamp(l + 16)),
    400: hslToHex(h, s*0.80, clamp(l + 8)),
    500: hslToHex(h, s, l),
    600: hslToHex(h, s*1.05, clamp(l - 8)),
    700: hslToHex(h, s*1.1, clamp(l - 16)),
    800: hslToHex(h, s*1.1, clamp(l - 24)),
    900: hslToHex(h, s*1.1, clamp(l - 32)),
  }
  return p
}

function injectThemeCSS(palette: Record<number, string>) {
  const id = 'tenant-theme-overrides'
  const existing = document.getElementById(id)
  const css = `:root{--brand-50:${palette[50]};--brand-500:${palette[500]};--brand-600:${palette[600]};--brand-700:${palette[700]};}
  .text-primary-600{color:var(--brand-600)!important}
  .text-primary-700{color:var(--brand-700)!important}
  .bg-primary-50{background-color:var(--brand-50)!important}
  .border-primary-600{border-color:var(--brand-600)!important}
  .ring-primary-500{--tw-ring-color:var(--brand-500)!important}
  .from-primary-500{--tw-gradient-from:var(--brand-500)!important;--tw-gradient-stops:var(--tw-gradient-from),var(--tw-gradient-to,rgba(255,255,255,0))!important}
  .to-primary-600{--tw-gradient-to:var(--brand-600)!important}`
  if (existing) existing.remove()
  const style = document.createElement('style')
  style.id = id
  style.textContent = css
  document.head.appendChild(style)
}

export function TenantSettingsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [settings, setSettings] = useState<TenantSettings>({})
  const [isLoading, setIsLoading] = useState(false)
  const appliedRef = useRef<string | null>(null)

  const applyBranding = (s: TenantSettings) => {
    const base = s?.branding_primary as string | undefined
    if (!base) return
    if (appliedRef.current === base) return
    appliedRef.current = base
    const palette = derivePalette(base)
    injectThemeCSS(palette)
  }

  const fetchIt = async () => {
    if (!user?.tenant_id) return
    setIsLoading(true)
    try {
      const res = await tenantsAPI.get(user.tenant_id)
      if (res.success) {
        const t = res.data as Tenant
        setTenant(t)
        const s = t?.settings || {}
        setSettings(s)
        applyBranding(s)
      }
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => { fetchIt() // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.tenant_id])

  // Re-apply branding when settings change
  useEffect(() => { applyBranding(settings) }, [settings])

  const value = useMemo(() => ({ tenant, settings, isLoading, refresh: fetchIt }), [tenant, settings, isLoading])
  return <TenantSettingsContext.Provider value={value}>{children}</TenantSettingsContext.Provider>
}
