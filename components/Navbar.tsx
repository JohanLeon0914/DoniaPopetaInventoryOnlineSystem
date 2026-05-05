'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { LogIn, LogOut, Package, ShoppingBag, ClipboardList, Menu, X, Wrench } from 'lucide-react'
import type { Tab } from '@/app/page'

interface NavbarProps {
  tab: Tab
  setTab: (t: Tab) => void
  onLoginClick: () => void
}

export default function Navbar({ tab, setTab, onLoginClick }: NavbarProps) {
  const { isAuthenticated, logout } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const navItem = (id: Tab, label: string, Icon: React.ElementType) => (
    <button
      onClick={() => {
        setTab(id)
        setMobileMenuOpen(false)
      }}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 18px',
        borderRadius: 8,
        border: 'none',
        background: tab === id ? 'var(--accent-light)' : 'transparent',
        color: tab === id ? 'var(--accent)' : 'var(--text-muted)',
        fontWeight: tab === id ? 700 : 500,
        fontSize: 14,
        cursor: 'pointer',
        transition: 'all 0.15s',
        width: '100%',
        justifyContent: 'flex-start',
      }}
    >
      <Icon size={16} />
      {label}
    </button>
  )

  return (
    <header style={{
      background: 'var(--surface)',
      borderBottom: '1.5px solid var(--border)',
      position: 'sticky', top: 0, zIndex: 50,
    }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '0 20px',
        height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36,
            background: 'var(--accent)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 800, fontSize: 18,
          }}>D</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>Doña Popeta</span>
        </div>

        {/* Desktop Nav */}
        <nav className="hidden md:flex gap-1">
          {navItem('inventory', 'Inventario', Package)}
          {navItem('products', 'Productos', ShoppingBag)}
          {navItem('orders', 'Pedidos', ClipboardList)}
          {navItem('production', 'Producción', Wrench)}
        </nav>

        {/* Desktop Auth */}
        <div className="hidden md:block">
          {isAuthenticated ? (
            <button className="btn-secondary" onClick={logout} style={{ fontSize: 13 }}>
              <LogOut size={14} /> Cerrar sesión
            </button>
          ) : (
            <button className="btn-secondary" onClick={onLoginClick} style={{ fontSize: 13 }}>
              <LogIn size={14} /> Administrar
            </button>
          )}
        </div>

        {/* Mobile Menu Button */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text)', padding: 8,
          }}
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden flex flex-col border-b border-gray-200" 
             style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
          {navItem('inventory', 'Inventario', Package)}
          {navItem('products', 'Productos', ShoppingBag)}
          {navItem('orders', 'Pedidos', ClipboardList)}
          {navItem('production', 'Producción', Wrench)}
          <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)' }}>
            {isAuthenticated ? (
              <button 
                className="btn-secondary" 
                onClick={() => {
                  logout()
                  setMobileMenuOpen(false)
                }} 
                style={{ fontSize: 13, width: '100%', justifyContent: 'center' }}
              >
                <LogOut size={14} /> Cerrar sesión
              </button>
            ) : (
              <button 
                className="btn-secondary" 
                onClick={() => {
                  onLoginClick()
                  setMobileMenuOpen(false)
                }} 
                style={{ fontSize: 13, width: '100%', justifyContent: 'center' }}
              >
                <LogIn size={14} /> Administrar
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
