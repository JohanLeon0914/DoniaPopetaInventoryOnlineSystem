'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Plus, Pencil, Trash2, ShoppingBag, X } from 'lucide-react'
import type { Product, RawMaterial, ProductIngredient } from '@/lib/types'
import NewOrderModal from './NewOrderModal'

export default function ProductsPage() {
  const { isAuthenticated } = useAuth()
  const [products, setProducts] = useState<Product[]>([])
  const [rawMaterials, setRawMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showOrder, setShowOrder] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [form, setForm] = useState({ name: '', sale_price: '' })
  const [ingredients, setIngredients] = useState<{ raw_material_id: number; quantity: string }[]>([])
  const [saving, setSaving] = useState(false)

  const fetchAll = async () => {
    const [{ data: prods }, { data: mats }] = await Promise.all([
      supabase.from('products').select('*, ingredients:product_ingredients(*, raw_material:raw_materials(*))').order('name'),
      supabase.from('raw_materials').select('*').order('name'),
    ])
    setProducts(prods || [])
    setRawMaterials(mats || [])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  const openForm = (product?: Product) => {
    if (product) {
      setEditing(product)
      setForm({ name: product.name, sale_price: String(product.sale_price) })
      setIngredients((product.ingredients || []).map((i: ProductIngredient) => ({
        raw_material_id: i.raw_material_id,
        quantity: String(i.quantity),
      })))
    } else {
      setEditing(null)
      setForm({ name: '', sale_price: '' })
      setIngredients([{ raw_material_id: rawMaterials[0]?.id || 0, quantity: '' }])
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.sale_price) return
    setSaving(true)

    const payload = { name: form.name, sale_price: parseFloat(form.sale_price) }
    let productId: number

    if (editing) {
      await supabase.from('products').update(payload).eq('id', editing.id)
      await supabase.from('product_ingredients').delete().eq('product_id', editing.id)
      productId = editing.id
    } else {
      const { data } = await supabase.from('products').insert(payload).select().single()
      productId = data.id
    }

    const validIngredients = ingredients.filter(i => i.raw_material_id && i.quantity)
    if (validIngredients.length > 0) {
      await supabase.from('product_ingredients').insert(
        validIngredients.map(i => ({
          product_id: productId,
          raw_material_id: i.raw_material_id,
          quantity: parseFloat(i.quantity),
        }))
      )
    }

    setSaving(false)
    setShowForm(false)
    fetchAll()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar este producto?')) return
    
    try {
      // Primero eliminar ingredientes del producto
      await supabase.from('product_ingredients').delete().eq('product_id', id)
      // Luego eliminar el producto
      await supabase.from('products').delete().eq('id', id)
      fetchAll()
    } catch (error: any) {
      if (error.code === '23503') { // Foreign key violation
        alert('No se puede eliminar este producto porque está siendo utilizado en pedidos o registros de producción. Elimina primero esos registros.')
      } else {
        alert('Error al eliminar el producto. Inténtalo de nuevo.')
      }
    }
  }

  const addIngredient = () => {
    setIngredients([...ingredients, { raw_material_id: rawMaterials[0]?.id || 0, quantity: '' }])
  }

  const removeIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx))
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-7">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Productos</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
            {products.length} {products.length === 1 ? 'producto registrado' : 'productos registrados'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button className="btn-secondary" onClick={() => setShowOrder(true)}>
            <ShoppingBag size={15} /> Nuevo pedido
          </button>
          {isAuthenticated && (
            <button className="btn-primary" onClick={() => openForm()}>
              <Plus size={15} /> Nuevo producto
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Cargando...</div>
      ) : products.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <ShoppingBag size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)' }}>No hay productos registrados.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {products.map(product => (
            <div key={product.id} className="card">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
                <div className="flex-1">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-3">
                    <h3 className="text-lg font-semibold m-0">{product.name}</h3>
                    <span style={{
                      background: 'var(--accent)',
                      color: 'white',
                      fontWeight: 700,
                      fontSize: 13,
                      padding: '2px 10px',
                      borderRadius: 6,
                    }}>
                      {fmt(product.sale_price)}
                    </span>
                  </div>
                  {product.ingredients && product.ingredients.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {product.ingredients.map((ing: ProductIngredient) => (
                        <span key={ing.id} style={{
                          background: 'var(--bg)',
                          border: '1px solid var(--border)',
                          fontSize: 12,
                          padding: '3px 10px',
                          borderRadius: 20,
                          color: 'var(--text-muted)',
                        }}>
                          {ing.raw_material?.name} • {ing.quantity} {ing.raw_material?.unit}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {isAuthenticated && (
                  <div className="flex gap-2 lg:ml-4">
                    <button className="btn-secondary" onClick={() => openForm(product)} style={{ padding: '7px 12px' }}>
                      <Pencil size={13} />
                    </button>
                    <button className="btn-danger" onClick={() => handleDelete(product.id)} style={{ padding: '7px 12px' }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 20,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
              {editing ? 'Editar producto' : 'Nuevo producto'}
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="label">Nombre del producto</label>
                <input className="input" placeholder="Ej: Empanada de pollo" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="label">Precio de venta (COP)</label>
                <input className="input" type="number" min="0" placeholder="0" value={form.sale_price}
                  onChange={e => setForm({ ...form, sale_price: e.target.value })} />
              </div>
            </div>

            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="label" style={{ margin: 0 }}>Materias primas que consume</label>
                <button className="btn-secondary" onClick={addIngredient} style={{ padding: '5px 12px', fontSize: 12 }}>
                  <Plus size={12} /> Agregar
                </button>
              </div>

              {ingredients.map((ing, idx) => (
                <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr,140px,36px] gap-2 mb-2">
                  <select className="input" value={ing.raw_material_id}
                    onChange={e => {
                      const updated = [...ingredients]
                      updated[idx].raw_material_id = parseInt(e.target.value)
                      setIngredients(updated)
                    }}>
                    {rawMaterials.map(m => <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>)}
                  </select>
                  <input className="input" type="number" min="0" step="0.01" placeholder="Cantidad"
                    value={ing.quantity}
                    onChange={e => {
                      const updated = [...ingredients]
                      updated[idx].quantity = e.target.value
                      setIngredients(updated)
                    }} />
                  <button onClick={() => removeIngredient(idx)} className="flex items-center justify-center" style={{
                    background: 'none', border: '1.5px solid var(--border)',
                    borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)',
                  }}>
                    <X size={14} />
                  </button>
                </div>
              ))}

              {rawMaterials.length === 0 && (
                <p style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Registra materias primas primero para asignarlas.
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end mt-5">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.sale_price}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showOrder && <NewOrderModal products={products} onClose={() => setShowOrder(false)} onCreated={fetchAll} />}
    </div>
  )
}
