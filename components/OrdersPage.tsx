'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { ClipboardList, CheckCircle, Clock, Trash2, Pencil, Download, X, Plus, ShoppingBag } from 'lucide-react'
import type { Order, OrderItem, Product } from '@/lib/types'
import NewOrderModal from './NewOrderModal'

export default function OrdersPage() {
  const { isAuthenticated } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showOrder, setShowOrder] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [editingName, setEditingName] = useState<{ orderId: number; name: string } | null>(null)
  const [editLines, setEditLines] = useState<{ product_id: number; quantity: number; unit_price: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [viewInvoice, setViewInvoice] = useState<Order | null>(null)
  const [showCombine, setShowCombine] = useState(false)
  const [selectedForCombine, setSelectedForCombine] = useState<number[]>([])
  const [combineName, setCombineName] = useState('')

  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })

  const fetchAll = async () => {
    const [{ data: ords }, { data: prods }] = await Promise.all([
      supabase.from('orders').select('*, items:order_items(*, product:products(*)), combined_orders:orders!parent_order_id(*, items:order_items(*, product:products(*)))').order('created_at', { ascending: false }),
      supabase.from('products').select('*').order('name'),
    ])
    setOrders(ords || [])
    setProducts(prods || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const handlePay = async (order: Order) => {
    if (!confirm('¿Marcar este pedido como pagado?')) return
    
    const now = new Date().toISOString()
    
    // Marcar la orden principal como pagada
    await supabase.from('orders').update({ paid: true, paid_at: now }).eq('id', order.id)
    
    // Si es una factura combinada (parent_order_id es null y tiene combined_orders), marcar todos los pedidos asociados
    if (!order.parent_order_id && order.combined_orders && order.combined_orders.length > 0) {
      const combinedIds = order.combined_orders.map(o => o.id)
      await supabase.from('orders').update({ paid: true, paid_at: now }).in('id', combinedIds)
    }
    
    fetchAll()
  }

  const handleCombineOrders = async () => {
    if (selectedForCombine.length < 2 || !combineName.trim()) return
    
    const selectedOrders = orders.filter(o => selectedForCombine.includes(o.id))
    const totalCombined = selectedOrders.reduce((sum, o) => sum + o.total, 0)
    
    // Crear la factura combinada
    const { data: combinedOrder } = await supabase
      .from('orders')
      .insert({ 
        name: combineName,
        total: totalCombined, 
        paid: false
      })
      .select()
      .single()
    
    if (combinedOrder) {
      // Actualizar los pedidos seleccionados para que tengan este parent_order_id
      await supabase
        .from('orders')
        .update({ parent_order_id: combinedOrder.id })
        .in('id', selectedForCombine)
    }
    
    setShowCombine(false)
    setSelectedForCombine([])
    setCombineName('')
    fetchAll()
  }

  const handleSaveName = async (orderId: number, newName: string) => {
    if (!newName.trim()) return
    await supabase.from('orders').update({ name: newName }).eq('id', orderId)
    setEditingName(null)
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

  const downloadPDF = async (order: Order) => {
    const element = document.getElementById('print-invoice')
    if (!element) return

    const fileName = order.name ? `${order.name}_${order.id}.pdf` : `Factura_${order.id}_${new Date().toISOString().split('T')[0]}.pdf`

    const clonedElement = element.cloneNode(true) as HTMLElement
    const buttonContainer = clonedElement.querySelector('#invoice-buttons')
    if (buttonContainer) {
      buttonContainer.remove()
    }

    const html2pdf = (await import('html2pdf.js')).default
    const options = {
      margin: 8,
      filename: fileName,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, allowTaint: true },
      jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a4' },
      pageBreak: { mode: ['avoid-all', 'css', 'legacy'] },
    }

    html2pdf().set(options).from(clonedElement).save()
  }

  const getProduct = (id: number) => products.find(p => p.id === id)

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <div>
      <div className="mb-7">
        <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Historial de Pedidos</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
          {orders.filter(o => !o.parent_order_id).length} pedidos en total · {orders.filter(o => !o.paid && !o.parent_order_id).length} pendientes de pago
        </p>
      </div>

      {isAuthenticated && (
        <div style={{ marginBottom: 20, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => setShowOrder(true)}>
            <ShoppingBag size={15} /> Nuevo pedido
          </button>
          {orders.filter(o => !o.paid && !o.parent_order_id).length > 1 && (
            <button className="btn-secondary" onClick={() => setShowCombine(true)}>
              <Plus size={15} /> Combinar pedidos
            </button>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <ClipboardList size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No hay pedidos aún. Crea uno desde aquí o desde la sección de Productos.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {orders.filter(o => !o.parent_order_id).map(order => (
            <div key={order.id} className="card">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                    {editingName?.orderId === order.id ? (
                      <div className="flex gap-2" style={{ flex: 1 }}>
                        <input 
                          className="input" 
                          value={editingName.name}
                          onChange={e => setEditingName({ ...editingName, name: e.target.value })}
                          style={{ flex: 1 }}
                        />
                        <button 
                          className="btn-primary" 
                          onClick={() => handleSaveName(order.id, editingName.name)}
                          style={{ padding: '8px 14px', fontSize: 13 }}
                        >
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="font-semibold text-base">{order.name || `Pedido #${order.id}`}</span>
                        {isAuthenticated && (
                          <button 
                            className="btn-ghost"
                            onClick={() => setEditingName({ orderId: order.id, name: order.name || '' })}
                            style={{ padding: '4px 8px', fontSize: 12 }}
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </>
                    )}
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
                  <Download size={13} /> Ver factura
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
          <div style={{ width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="card" style={{ width: '100%' }} id="print-invoice">
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{
                width: 48, height: 48, background: 'var(--accent)', borderRadius: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 10px', color: 'white', fontWeight: 900, fontSize: 20,
              }}>D</div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Doña Popeta</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '4px 0 2px' }}>
                {viewInvoice.combined_orders && viewInvoice.combined_orders.length > 0 ? 'Factura Combinada' : `Pedido #${viewInvoice.id}`}
              </p>
              {viewInvoice.name && (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: '2px 0' }}>{viewInvoice.name}</p>
              )}
              <p style={{ color: 'var(--text-muted)', fontSize: 13, margin: 0 }}>
                {new Date(viewInvoice.created_at).toLocaleDateString('es-CO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>

            {viewInvoice.combined_orders && viewInvoice.combined_orders.length > 0 ? (
              // Mostrar factura combinada con todos los pedidos
              <div style={{ borderTop: '1.5px solid var(--border)', borderBottom: '1.5px solid var(--border)', padding: '14px 0', marginBottom: 14 }}>
                {viewInvoice.combined_orders.map((combinedOrder: Order) => (
                  <div key={combinedOrder.id} style={{ marginBottom: 14, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', marginBottom: 6 }}>
                      Pedido {combinedOrder.name ? `"${combinedOrder.name}"` : `#${combinedOrder.id}`}
                    </div>
                    {(combinedOrder.items || []).map((item: OrderItem) => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 13 }}>
                        <span>
                          <span>{item.product?.name}</span>
                          <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>x{item.quantity}</span>
                        </span>
                        <span style={{ fontWeight: 600 }}>{fmt(item.unit_price * item.quantity)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 4, paddingTop: 4, borderTop: '1px dashed var(--border)', color: 'var(--text-muted)' }}>
                      <span>Subtotal:</span>
                      <span>{fmt(combinedOrder.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Mostrar pedido simple
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
            )}

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

            <div id="invoice-buttons" className="flex flex-col sm:flex-row gap-3 justify-end">
              <button className="btn-secondary" onClick={() => downloadPDF(viewInvoice)}>
                <Download size={14} /> Descargar PDF
              </button>
              <button className="btn-primary" onClick={() => setViewInvoice(null)}>
                Cerrar
              </button>
            </div>
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

      {/* New Order Modal */}
      {showOrder && (
        <NewOrderModal 
          products={products} 
          onClose={() => setShowOrder(false)} 
          onCreated={() => fetchAll()} 
        />
      )}

      {/* Combine Orders Modal */}
      {showCombine && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Combinar pedidos</h2>
              <button onClick={() => setShowCombine(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>

            <div className="mb-4">
              <label className="label">Nombre de la factura (opcional)</label>
              <input 
                className="input" 
                placeholder="Ej: Factura de Marzo" 
                value={combineName}
                onChange={e => setCombineName(e.target.value)} 
              />
            </div>

            <div className="mb-4">
              <label className="label">Selecciona los pedidos a combinar</label>
              <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
                {orders.filter(o => !o.paid && !o.parent_order_id).map(order => (
                  <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid var(--border)' }}>
                    <input 
                      type="checkbox" 
                      id={`order-${order.id}`}
                      checked={selectedForCombine.includes(order.id)}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedForCombine([...selectedForCombine, order.id])
                        } else {
                          setSelectedForCombine(selectedForCombine.filter(id => id !== order.id))
                        }
                      }}
                      style={{ width: 18, height: 18, cursor: 'pointer' }}
                    />
                    <label htmlFor={`order-${order.id}`} style={{ flex: 1, cursor: 'pointer', fontSize: 14 }}>
                      <div style={{ fontWeight: 600 }}>{order.name || `Pedido #${order.id}`}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{fmt(order.total)}</div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {selectedForCombine.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 15 }}>
                  <span>Total combinado</span>
                  <span style={{ color: 'var(--accent)' }}>
                    {fmt(orders.filter(o => selectedForCombine.includes(o.id)).reduce((sum, o) => sum + o.total, 0))}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowCombine(false)}>Cancelar</button>
              <button 
                className="btn-primary" 
                onClick={handleCombineOrders} 
                disabled={selectedForCombine.length < 2 || saving}
              >
                {saving ? 'Combinando...' : `Combinar ${selectedForCombine.length} pedidos`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
