'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { X, Lock } from 'lucide-react'

export default function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const ok = await login(password)
    setLoading(false)
    if (ok) {
      onClose()
    } else {
      setError('Contraseña incorrecta. Intenta de nuevo.')
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16,
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 4,
        }}>
          <X size={18} />
        </button>

        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, background: 'var(--accent-light)',
            borderRadius: 12, display: 'flex', alignItems: 'center',
            justifyContent: 'center', margin: '0 auto 12px',
            color: 'var(--accent)',
          }}>
            <Lock size={22} />
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Zona de administración</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Ingresa tu contraseña para continuar</p>
        </div>

        <label className="label">Contraseña</label>
        <input
          className="input"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          autoFocus
        />

        {error && (
          <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{error}</p>
        )}

        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={loading || !password}
          style={{ width: '100%', marginTop: 20, justifyContent: 'center' }}
        >
          {loading ? 'Verificando...' : 'Ingresar'}
        </button>
      </div>
    </div>
  )
}
