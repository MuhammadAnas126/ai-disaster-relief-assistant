'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User } from '../types'
import { getStoredUser, setStoredUser, setToken } from './api'

interface AuthContextValue {
  user: User | null
  setUser: (user: User | null) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)

  // Hydrate from localStorage on the client only (avoids SSR/client mismatch).
  useEffect(() => {
    setUserState(getStoredUser())
  }, [])

  function setUser(next: User | null) {
    setUserState(next)
    setStoredUser(next)
  }

  function logout() {
    setToken(null)
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, setUser, logout }}>{children}</AuthContext.Provider>
}

export function useAuthContext() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuthContext must be used within an AuthProvider')
  return ctx
}
