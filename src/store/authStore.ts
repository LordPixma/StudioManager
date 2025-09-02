import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { User, AuthState } from '../types'

interface AuthStore extends AuthState {
  // Actions
  setAuth: (user: User, token: string) => void
  clearAuth: () => void
  setLoading: (loading: boolean) => void
  updateSessionTimeout: (timeout: string) => void
  updateUser: (partial: Partial<User>) => void
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      isLoading: false,
      sessionTimeout: undefined,

      setAuth: (user: User, token: string) => {
        localStorage.setItem('auth_token', token)
        set({ user, token, isLoading: false })
      },

      clearAuth: () => {
        localStorage.removeItem('auth_token')
        set({ user: null, token: null, isLoading: false, sessionTimeout: undefined })
      },

      setLoading: (isLoading: boolean) => set({ isLoading }),

      updateSessionTimeout: (sessionTimeout: string) => set({ sessionTimeout }),

  updateUser: (partial: Partial<User>) => set((state) => ({ user: state.user ? { ...state.user, ...partial } : state.user })),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        user: state.user,
        token: state.token,
        sessionTimeout: state.sessionTimeout 
      }),
    }
  )
)