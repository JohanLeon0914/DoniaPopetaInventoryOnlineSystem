'use client'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import LoginModal from '@/components/LoginModal'
import Navbar from '@/components/Navbar'
import InventoryPage from '@/components/InventoryPage'
import ProductsPage from '@/components/ProductsPage'
import OrdersPage from '@/components/OrdersPage'

export type Tab = 'inventory' | 'products' | 'orders'

export default function Home() {
  const { isAuthenticated } = useAuth()
  const [tab, setTab] = useState<Tab>('inventory')
  const [showLogin, setShowLogin] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar tab={tab} setTab={setTab} onLoginClick={() => setShowLogin(true)} />
      <main className="max-w-6xl mx-auto px-5 py-8 md:px-5 lg:px-5 xl:px-5" style={{ padding: '32px 20px' }}>
        {tab === 'inventory' && <InventoryPage />}
        {tab === 'products' && <ProductsPage />}
        {tab === 'orders' && <OrdersPage />}
      </main>
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
