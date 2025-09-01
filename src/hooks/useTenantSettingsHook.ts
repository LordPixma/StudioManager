import { useContext } from 'react'
import { TenantSettingsContext } from './useTenantSettings'

export function useTenantSettings() {
  const ctx = useContext(TenantSettingsContext)
  if (!ctx) throw new Error('useTenantSettings must be used within TenantSettingsProvider')
  return ctx
}
