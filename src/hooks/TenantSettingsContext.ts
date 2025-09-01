import { createContext } from 'react'
import type { Tenant } from '../types'

export type TenantSettings = {
  branding_primary?: string
  branding_logo_url?: string
} & Record<string, unknown>

export interface TenantSettingsContextType {
  tenant: Tenant | null
  settings: TenantSettings
  isLoading: boolean
  refresh: () => Promise<void>
}

export const TenantSettingsContext = createContext<TenantSettingsContextType | null>(null)
