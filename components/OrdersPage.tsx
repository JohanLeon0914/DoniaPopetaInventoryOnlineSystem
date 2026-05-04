'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { ClipboardList, CheckCircle, Clock, Trash2, Pencil, Printer, X, Plus } from 'lucide-react'
import type { Order, OrderItem, Product } from '@/lib/types'

export default function OrdersPage() {
  const { isAuthenticated } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editLines, setEditLines] = useState<{ product_id: number; quantity: number; unit_price: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [viewInvoice, setViewInvoice] = useState<Order | null>(null)

  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

  const fetchAll = async () => {
    const [{ data: ords }, { data: prods }] = await Promise.all([
      supabase.from('orders').select('*, items:order_items(*, product:products(*))').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
    ])
    setOrders(ords || [])
    setProducts(prods || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handlePay = async (order: Order) => {
    if (!confirm('¿Marcar este pedido como pagado?')) return
    await supabase.from('orders').update({ paid: true, paid_at: new Date().toISOString() }).eq('id', order.id)
    fetchAll()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este pedido? Esta acción no se puede deshacer.')) return
    await supabase.from('order_items').delete().eq('order_id', id)
    await supabase.from('orders').delete().eq('id', id)
    fetchAll()
  }

  const openEdit = (order: Order) => {
    setEditingOrder(order)
    setEditLines((order.items || []).map((i: OrderItem) => ({
      product_id: i.product_id,
      quantity: i.quantity,
      unit_price: i.unit_price,
    })))
  }

  const handleSaveEdit = async () => {
    if (!editingOrder) return
    setSaving(true)
    const newTotal = editLines.reduce((acc, l) => acc + l.unit_price * l.quantity, 0)
    await supabase.from('order_items').delete().eq('order_id', editingOrder.id)
    await supabase.from('order_items').insert(editLines.map(l => ({
      order_id: editingOrder.id,
      product_id: l.product_id,
      quantity: l.quantity,
      unit_price: l.unit_price,
    })))
    await supabase.from('orders').update({ total: newTotal }).eq('id', editingOrder.id)
    setSaving(false)
    setEditingOrder(null)
    fetchAll()
  }

  const getProduct = (id: number) => products.find(p => p.id === id)

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Historial de Pedidos</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
          {orders.length} pedidos en total · {orders.filter(o => !o.paid).length} pendientes de pago
        </p>
      </div>

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <ClipboardList size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No hay pedidos aún. Crea uno desde la sección de Productos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.map(order => (
            <div key={order.id} className="card">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                    <span className="font-semibold text-base">Pedido #{order.id}</span>
                    {order.paid
                      ? <span className="badge-paid">✓ Pagado</span>
                      : <span className="badge-unpaid">⏳ Pendiente</span>
                    }
                  </div>
                  <p className="m-0 text-sm" style={{ color: 'var(--text-muted)' }}>
                    Creado: {fmtDate(order.created_at)} a las {fmtTime(order.created_at)}
                  </p>
                  {order.paid && order.paid_at && (
                    <p className="m-0 pt-1 text-sm" style={{ color: 'var(--success)' }}>
                      Pagado: {fmtDate(order.paid_at)} a las {fmtTime(order.paid_at)}
                    </p>
                  )}
                  <div className="text-xl font-bold mt-3 mb-0" style={{ color: 'var(--accent)' }}>
                    {fmt(order.total)}
                  </div>
                </div>
              </div>

              {/* Items */}
              {order.items && order.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200" style={{ borderTop: '1px solid var(--border)' }}>
                  {order.items.map((item: OrderItem) => (
                    <div key={item.id} className="flex justify-between text-sm py-1">
                      <span>{item.product?.name} <span style={{ color: 'var(--text-muted)' }}>x{item.quantity}</span></span>
                      <span style={{ color: 'var(--text-muted)' }}>{fmt(item.unit_price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button className="btn-secondary" onClick={() => setViewInvoice(order)} style={{ fontSize: 13, padding: '7px 14px' }}>
                  <Printer size={13} /> Ver factura
                </button>
                {isAuthenticated && !order.paid && (
                  <button className="btn-primary" onClick={() => handlePay(order)} style={{ fontSize: 13, padding: '7px 14px' }}>
                    <CheckCircle size={13} /> Marcar pagado
                  </button>
                )}
                {isAuthenticated && (
                  <>
                    <button className="btn-secondary" onClick={() => openEdit(order)} style={{ fontSize: 13, padding: '7px 14px' }}>
                      <Pencil size={13} /> Editar
                    </button>
                    <button className="btn-danger" onClick={() => handleDelete(order.id)} style={{ fontSize: 13, padding: '7px 14px' }}>
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Invoice Modal */}
      {viewInvoice && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 460 }} id="print-invoice">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, background: 'var(--accent)', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px', color: 'white', fontWeight: 900, fontSize: 20,
              }}>D</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Doña Popeta</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 2px' }}>Pedido #{viewInvoice.id}</p>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                {new Date(viewInvoice.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            <div style={{ borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)', padding: '14px 0', marginBottom: 14 }}>
              {(viewInvoice.items || []).map((item: OrderItem) => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', fontSize: 14 }}>
                  <span>
                    <strong>{item.product?.name}</strong>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>x{item.quantity}</span>
                    <span style={{ color: 'var(--text-muted)', marginLeft: 8, fontSize: 12 }}>{fmt(item.unit_price)} c/u</span>
                  </span>
                  <span style={{ fontWeight: 600 }}>{fmt(item.unit_price * item.quantity)}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 17, marginBottom: 16 }}>
              <span>Total</span>
              <span style={{ color: 'var(--accent)' }}>{fmt(viewInvoice.total)}</span>
            </div>

            <div style={{
              borderRadius: 8, padding: '8px 14px', textAlign: 'center', fontSize: 13, fontWeight: 600, marginBottom: 20,
              background: viewInvoice.paid ? 'var(--success-light)' : '#fff8ec',
              color: viewInvoice.paid ? 'var(--success)' : 'var(--accent)',
              border: `1px solid ${viewInvoice.paid ? '#a8e6c0' : '#f0d49a'}`,
            }}>
              {viewInvoice.paid
                ? `✓ Pagado el ${new Date(viewInvoice.paid_at!).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })}`
                : '⏳ Pendiente de pago'
              }
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button className="btn-secondary" onClick={() => window.print()}>
                <Printer size={14} /> Imprimir
              </button>
              <button className="btn-primary" onClick={() => setViewInvoice(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Editar pedido #{editingOrder.id}</h2>
              <button onClick={() => setEditingOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            {editLines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr,100px,36px] gap-2 mb-2">
                <select className="input" value={line.product_id}
                  onChange={e => {
                    const updated = [...editLines]
                    const p = getProduct(parseInt(e.target.value))
                    updated[idx] = { product_id: parseInt(e.target.value), quantity: updated[idx].quantity, unit_price: p?.sale_price || 0 }
                    setEditLines(updated)
                  }}>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="input" type="number" min="1" value={line.quantity}
                  onChange={e => {
                    const updated = [...editLines]
                    updated[idx].quantity = parseInt(e.target.value) || 1
                    setEditLines(updated)
                  }} />
                <button onClick={() => setEditLines(editLines.filter((_, i) => i !== idx))} className="flex items-center justify-center" style={{
                  background: 'none', border: '1.5px solid var(--border)',
                  borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)',
                }}>
                  <X size={14} />
                </button>
              </div>
            ))}

            <button className="btn-secondary" onClick={() => {
              const p = products[0]
              setEditLines([...editLines, { product_id: p.id, quantity: 1, unit_price: p.sale_price }])
            }} style={{ marginBottom: 20, fontSize: 13 }}>
              <Plus size={13} /> Agregar producto
            </button>

            <div style={{ borderTop: '1.5px solid var(--border)', paddingTop: 12, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15 }}>
                <span>Nuevo total</span>
                <span style={{ color: 'var(--accent)' }}>
                  {fmt(editLines.reduce((acc, l) => acc + l.unit_price * l.quantity, 0))}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setEditingOrder(null)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSaveEdit} disabled={saving}>
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
