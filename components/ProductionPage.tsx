'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Plus, Pencil, Trash2, Package, Eye, X } from 'lucide-react'
import type { ProductionRecord, ProductionItem, Product, RawMaterial } from '@/lib/types'

export default function ProductionPage() {
  const { isAuthenticated } = useAuth()
  const [records, setRecords] = useState<ProductionRecord[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [viewRecord, setViewRecord] = useState<ProductionRecord | null>(null)
  const [editing, setEditing] = useState<ProductionRecord | null>(null)
  const [form, setForm] = useState({ 
    production_date: new Date().toISOString().split('T')[0],
    notes: '' 
  })
  const [items, setItems] = useState<{ product_id: number; quantity: number }[]>([])
  const [saving, setSaving] = useState(false)

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('es-CO', { 
    day: '2-digit', month: 'short', year: 'numeric' 
  })

  const fetchAll = async () => {
    const [{ data: recs }, { data: prods }, { data: mats }] = await Promise.all([
      supabase.from('production_records')
        .select('*, items:production_items(*, product:products(*))')
        .order('production_date', { ascending: false }),
      supabase.from('products').select('*, ingredients:product_ingredients(*, raw_material:raw_materials(*))').order('name'),
      supabase.from('raw_materials').select('*').order('name'),
    ])
    setRecords(recs || [])
    setProducts(prods || [])
    setRawMaterials(mats || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openForm = (record?: ProductionRecord) => {
    if (record) {
      setEditing(record)
      setForm({ 
        production_date: record.production_date,
        notes: record.notes || ''
      })
      setItems((record.items || []).map((i: ProductionItem) => ({
        product_id: i.product_id,
        quantity: i.quantity,
      })))
    } else {
      setEditing(null)
      setForm({ 
        production_date: new Date().toISOString().split('T')[0],
        notes: ''
      })
      setItems([{ product_id: products[0]?.id || 0, quantity: 1 }])
    }
    setShowForm(true)
  }

  const checkRawMaterialAvailability = (productItems: { product_id: number; quantity: number }[]) => {
    const shortages: string[] = []
    
    for (const item of productItems) {
      const product = products.find(p => p.id === item.product_id)
      if (!product?.ingredients) continue
      
      for (const ingredient of product.ingredients) {
        const rawMaterial = rawMaterials.find(rm => rm.id === ingredient.raw_material_id)
        if (!rawMaterial) continue
        
        const requiredQuantity = ingredient.quantity * item.quantity
        if (rawMaterial.quantity < requiredQuantity) {
          shortages.push(
            `${rawMaterial.name}: se necesitan ${requiredQuantity} ${rawMaterial.unit}, pero solo hay ${rawMaterial.quantity} ${rawMaterial.unit}`
          )
        }
      }
    }
    
    return shortages
  }

  const deductRawMaterials = async (productItems: { product_id: number; quantity: number }[]) => {
    for (const item of productItems) {
      const product = products.find(p => p.id === item.product_id)
      if (!product?.ingredients) continue
      
      for (const ingredient of product.ingredients) {
        const requiredQuantity = ingredient.quantity * item.quantity
        
        // Primero obtener el valor actual
        const { data: currentMaterial } = await supabase
          .from('raw_materials')
          .select('quantity')
          .eq('id', ingredient.raw_material_id)
          .single()
        
        if (currentMaterial) {
          const newQuantity = currentMaterial.quantity - requiredQuantity
          
          // Actualizar con el nuevo valor
          await supabase
            .from('raw_materials')
            .update({ quantity: newQuantity })
            .eq('id', ingredient.raw_material_id)
        }
      }
    }
  }

  const handleSave = async () => {
    if (!form.production_date || items.length === 0) return
    
    // Verificar disponibilidad de materias primas
    const shortages = checkRawMaterialAvailability(items)
    if (shortages.length > 0) {
      alert(`No hay suficiente materia prima:\n${shortages.join('\n')}`)
      return
    }

    setSaving(true)

    try {
      let recordId: number

      if (editing) {
        await supabase.from('production_records').update({
          production_date: form.production_date,
          notes: form.notes
        }).eq('id', editing.id)
        await supabase.from('production_items').delete().eq('production_record_id', editing.id)
        recordId = editing.id
      } else {
        const { data, error } = await supabase.from('production_records').insert({
          production_date: form.production_date,
          notes: form.notes
        }).select().single()
        
        if (error) {
          if (error.code === '23505') { // Unique violation
            alert('Ya existe un registro de producción para esta fecha. Por favor, edita el registro existente o selecciona otra fecha.')
            setSaving(false)
            return
          }
          throw error
        }
        
        recordId = data.id
      }

      // Insertar items de producción
      const validItems = items.filter(i => i.product_id && i.quantity > 0)
      if (validItems.length > 0) {
        await supabase.from('production_items').insert(
          validItems.map(i => ({
            production_record_id: recordId,
            product_id: i.product_id,
            quantity: i.quantity,
          }))
        )

        // Descontar materias primas
        await deductRawMaterials(validItems)
      }

      setSaving(false)
      setShowForm(false)
      fetchAll()
    } catch (error) {
      console.error('Error al guardar producción:', error)
      setSaving(false)
      alert('Error al guardar la producción')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este registro de producción? Esta acción no se puede deshacer.')) return
    await supabase.from('production_records').delete().eq('id', id)
    fetchAll()
  }

  const addItem = () => {
    setItems([...items, { product_id: products[0]?.id || 0, quantity: 1 }])
  }

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const getProduct = (id: number) => products.find(p => p.id === id)

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Cargando...</div>

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-7">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Producción</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
            {records.length} {records.length === 1 ? 'registro de producción' : 'registros de producción'}
          </p>
        </div>
        {isAuthenticated && (
          <button className="btn-primary w-full sm:w-auto" onClick={() => openForm()}>
            <Plus size={15} /> Nuevo registro
          </button>
        )}
      </div>

      {records.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <Package size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No hay registros de producción.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {records.map(record => (
            <div key={record.id} className="card">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-2">
                    <span className="font-semibold text-base">
                      Producción - {fmtDate(record.production_date)}
                    </span>
                    <span style={{
                      background: 'var(--accent-light)',
                      color: 'var(--accent)',
                      fontWeight: 700,
                      fontSize: 12,
                      padding: '2px 10px',
                      borderRadius: 6,
                    }}>
                      {record.items?.length || 0} productos
                    </span>
                  </div>
                  <p className="m-0 text-sm" style={{ color: 'var(--text-muted)' }}>
                    {record.notes || 'Sin notas'}
                  </p>
                </div>
              </div>

              {/* Items preview */}
              {record.items && record.items.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200" style={{ borderTop: '1px solid var(--border)' }}>
                  <div className="text-sm font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    Productos producidos:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {record.items.slice(0, 3).map((item: ProductionItem) => (
                      <span key={item.id} style={{
                        background: 'var(--bg)',
                        border: '1px solid var(--border)',
                        fontSize: 12,
                        padding: '3px 10px',
                        borderRadius: 20,
                        color: 'var(--text-muted)',
                      }}>
                        {item.product?.name} x{item.quantity}
                      </span>
                    ))}
                    {(record.items?.length || 0) > 3 && (
                      <span style={{
                        background: 'var(--accent-light)',
                        color: 'var(--accent)',
                        fontSize: 12,
                        padding: '3px 10px',
                        borderRadius: 20,
                        fontWeight: 600,
                      }}>
                        +{(record.items?.length || 0) - 3} más
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2 mt-4">
                <button 
                  className="btn-secondary" 
                  onClick={() => setViewRecord(record)} 
                  style={{ fontSize: 13, padding: '7px 14px' }}
                >
                  <Eye size={13} /> Ver detalle
                </button>
                {isAuthenticated && (
                  <>
                    <button 
                      className="btn-secondary" 
                      onClick={() => openForm(record)} 
                      style={{ fontSize: 13, padding: '7px 14px' }}
                    >
                      <Pencil size={13} /> Editar
                    </button>
                    <button 
                      className="btn-danger" 
                      onClick={() => handleDelete(record.id)} 
                      style={{ fontSize: 13, padding: '7px 14px' }}
                    >
                      <Trash2 size={13} /> Eliminar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Production Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 20,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {editing ? 'Editar producción' : 'Nuevo registro de producción'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ 
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' 
              }}>
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Fecha de producción</label>
                <input 
                  className="input" 
                  type="date" 
                  value={form.production_date}
                  onChange={e => setForm({ ...form, production_date: e.target.value })} 
                />
              </div>
              <div>
                <label className="label">Notas (opcional)</label>
                <input 
                  className="input" 
                  placeholder="Notas sobre esta producción"
                  value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })} 
                />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="label" style={{ margin: 0 }}>Productos producidos</label>
                <button className="btn-secondary" onClick={addItem} style={{ padding: '5px 12px', fontSize: 12 }}>
                  <Plus size={12} /> Agregar
                </button>
              </div>

              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr,100px,36px] gap-2 mb-2">
                  <select className="input" value={item.product_id}
                    onChange={e => {
                      const updated = [...items]
                      updated[idx].product_id = parseInt(e.target.value)
                      setItems(updated)
                    }}>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input className="input" type="number" min="1" value={item.quantity}
                    onChange={e => {
                      const updated = [...items]
                      updated[idx].quantity = parseInt(e.target.value) || 1
                      setItems(updated)
                    }} />
                  <button onClick={() => removeItem(idx)} className="flex items-center justify-center" style={{
                    background: 'none', border: '1.5px solid var(--border)',
                    borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)',
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ))}

              {products.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Registra productos primero para poder producir.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end mt-5">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button 
                className="btn-primary" 
                onClick={handleSave} 
                disabled={saving || !form.production_date || items.length === 0}
              >
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* View Record Modal */}
      {viewRecord && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 20,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                Detalle de Producción
              </h2>
              <button onClick={() => setViewRecord(null)} style={{ 
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' 
              }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>Fecha:</span>
                <span>{fmtDate(viewRecord.production_date)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontWeight: 600 }}>Notas:</span>
                <span>{viewRecord.notes || 'Sin notas'}</span>
              </div>
            </div>

            <div style={{ borderTop: '1.5px solid var(--border)', paddingTop: 16, marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px' }}>Productos producidos:</h3>
              {viewRecord.items?.map((item: ProductionItem) => (
                <div key={item.id} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  padding: '8px 0',
                  borderBottom: '1px solid var(--border)'
                }}>
                  <span>{item.product?.name}</span>
                  <span style={{ fontWeight: 600 }}>x{item.quantity}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button className="btn-primary" onClick={() => setViewRecord(null)}>
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
