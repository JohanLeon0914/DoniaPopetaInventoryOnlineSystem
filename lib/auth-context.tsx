'use client'
import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface AuthContextType {
  isAuthenticated: boolean
  login: (password: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  login: async () => false,
  logout: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  useEffect(() => {
    const auth = sessionStorage.getItem('dp_auth')
    if (auth === 'true') setIsAuthenticated(true)
  }, [])

  const login = async (password: string): Promise<boolean> => {
    const { supabase } = await import('@/lib/supabase')
    const { data, error } = await supabase
      .from('admin')
      .select('password')
      .single()

    if (error || !data) return false

    if (data.password === password) {
      setIsAuthenticated(true)
      sessionStorage.setItem('dp_auth', 'true')
      return true
    }
    return false
  }

  const logout = () => {
    setIsAuthenticated(false)
    sessionStorage.removeItem('dp_auth')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
