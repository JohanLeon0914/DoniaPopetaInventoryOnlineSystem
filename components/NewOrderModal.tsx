'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Printer } from 'lucide-react'
import type { Product } from '@/lib/types'

interface Props {
  products: Product[]
  onClose: () => void
  onCreated: () => void
}

interface OrderLine {
  product_id: number
  quantity: number
}

export default function NewOrderModal({ products, onClose, onCreated }: Props) {
  const [lines, setLines] = useState<OrderLine[]>([{ product_id: products[0]?.id || 0, quantity: 1 }])
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(false)
  const [orderId, setOrderId] = useState<number | null>(null)

  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  const getProduct = (id: number) => products.find(p => p.id === id)

  const total = lines.reduce((acc, l) => {
    const p = getProduct(l.product_id)
    return acc + (p?.sale_price || 0) * l.quantity
  }, 0)

  const addLine = () => setLines([...lines, { product_id: products[0]?.id || 0, quantity: 1 }])
  const removeLine = (idx: number) => setLines(lines.filter((_, i) => i !== idx))

  const handleCreate = async () => {
    if (lines.length === 0) return
    setSaving(true)

    const { data: order } = await supabase
      .from('orders')
      .insert({ total, paid: false })
      .select()
      .single()

    if (order) {
      await supabase.from('order_items').insert(
        lines.map(l => ({
          order_id: order.id,
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: getProduct(l.product_id)?.sale_price || 0,
        }))
      )
      setOrderId(order.id)
      setCreated(true)
    }

    setSaving(false)
    onCreated()
  }

  const handlePrint = () => window.print()

  const now = new Date()
  const dateStr = now.toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })

  if (created) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 100, padding: 20,
      }}>
        <div className="card" style={{ width: '100%', maxWidth: 480 }} id="invoice">
          {/* Invoice */}
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div style={{
              width: 52, height: 52, background: 'var(--accent)',
              borderRadius: 12, display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 12px', color: 'white',
              fontWeight: 900, fontSize: 22,
            }}>D</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Doña Popeta</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 0' }}>Pedido #{orderId}</p>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 2 }}>{dateStr}</p>
          </div>

          <div style={{ borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)', padding: '16px 0', marginBottom: 16 }}>
            {lines.map((line, idx) => {
              const p = getProduct(line.product_id)
              if (!p) return null
              const subtotal = p.sale_price * line.quantity
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 14 }}>
                  <span>
                    <strong>{p.name}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>x{line.quantity}</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(subtotal)}</span>
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>Total</span>
            <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{fmt(total)}</span>
          </div>

          <div style={{
            background: '#fff8ec',
            border: '1px solid #f0d49a',
            borderRadius: 8,
            padding: '10px 14px',
            fontSize: 13,
            color: 'var(--accent)',
            fontWeight: 600,
            textAlign: 'center',
            marginBottom: 20,
          }}>
            Estado: PENDIENTE DE PAGO
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <button className="btn-secondary" onClick={handlePrint}>
              <Printer size={14} /> Imprimir
            </button>
            <button className="btn-primary" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 20,
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Nuevo pedido</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {lines.map((line, idx) => (
          <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr,100px,36px] gap-2 mb-2">
            <select className="input" value={line.product_id}
              onChange={e => {
                const updated = [...lines]
                updated[idx].product_id = parseInt(e.target.value)
                setLines(updated)
              }}>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <input className="input" type="number" min="1" value={line.quantity}
              onChange={e => {
                const updated = [...lines]
                updated[idx].quantity = parseInt(e.target.value) || 1
                setLines(updated)
              }} />
            <button onClick={() => removeLine(idx)} className="flex items-center justify-center" style={{
              background: 'none', border: '1.5px solid var(--border)',
              borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)',
            }}>
              <X size={14} />
            </button>
          </div>
        ))}

        <button className="btn-secondary" onClick={addLine} style={{ marginBottom: 20, fontSize: 13 }}>
          <Plus size={13} /> Agregar producto
        </button>

        {/* Summary */}
        <div style={{ borderTop: '1.5px solid var(--border)', paddingTop: 16, marginBottom: 20 }}>
          {lines.map((line, idx) => {
            const p = getProduct(line.product_id)
            if (!p) return null
            return (
              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0', color: 'var(--text-muted)' }}>
                <span>{p.name} x{line.quantity}</span>
                <span>{fmt(p.sale_price * line.quantity)}</span>
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 16, marginTop: 10 }}>
            <span>Total</span>
            <span style={{ color: 'var(--accent)' }}>{fmt(total)}</span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-end">
          <button className="btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn-primary" onClick={handleCreate} disabled={saving || lines.length === 0}>
            {saving ? 'Creando...' : 'Crear pedido'}
          </button>
        </div>
      </div>
    </div>
  )
}
