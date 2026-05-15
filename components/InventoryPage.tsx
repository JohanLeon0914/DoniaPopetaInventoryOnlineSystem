'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/lib/auth-context'
import { Plus, Pencil, Trash2, Package } from 'lucide-react'
import type { RawMaterial } from '@/lib/types'

const UNITS = ['kg', 'g', 'litros', 'ml', 'unidades', 'porciones', 'paquetes', 'bolsas', 'cajas']

export default function InventoryPage() {
  const { isAuthenticated } = useAuth()
  const [items, setItems] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<RawMaterial | null>(null)
  const [form, setForm] = useState({ name: '', unit: 'kg', quantity: '', cost_per_unit: '' })
  const [saving, setSaving] = useState(false)

  const fetchItems = async () => {
    const { data } = await supabase.from('raw_materials').select('*').order('name')
    setItems(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchItems() }, [])

  const openForm = (item?: RawMaterial) => {
    if (item) {
      setEditing(item)
      setForm({
        name: item.name,
        unit: item.unit,
        quantity: String(item.quantity),
        cost_per_unit: item.cost_per_unit != null ? String(item.cost_per_unit) : ''
      })
    } else {
      setEditing(null)
      setForm({ name: '', unit: 'kg', quantity: '', cost_per_unit: '' })
    }
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.name || !form.quantity) return
    setSaving(true)
    const payload = {
      name: form.name,
      unit: form.unit,
      quantity: parseFloat(form.quantity),
      cost_per_unit: form.cost_per_unit ? parseFloat(form.cost_per_unit) : null,
    }

    if (editing) {
      await supabase.from('raw_materials').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('raw_materials').insert(payload)
    }

    setSaving(false)
    setShowForm(false)
    fetchItems()
  }

  const handleDelete = async (id: number) => {
    if (!confirm('¿Eliminar esta materia prima?')) return
    
    try {
      await supabase.from('raw_materials').delete().eq('id', id)
      fetchItems()
    } catch (error: any) {
      if (error.code === '23503') { // Foreign key violation
        alert('No se puede eliminar esta materia prima porque está siendo utilizada en productos. Elimina primero los productos que la usan.')
      } else {
        alert('Error al eliminar la materia prima. Inténtalo de nuevo.')
      }
    }
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-7">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Inventario de Materias Primas</h1>
          <p style={{ color: 'var(--text-muted)', marginTop: 4, fontSize: 14 }}>
            {items.length} {items.length === 1 ? 'item registrado' : 'items registrados'}
          </p>
        </div>
        {isAuthenticated && (
          <button className="btn-primary w-full sm:w-auto" onClick={() => openForm()}>
            <Plus size={16} /> Nueva materia prima
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>Cargando...</div>
      ) : items.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <Package size={40} style={{ color: 'var(--text-muted)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>No hay materias primas registradas aún.</p>
          {isAuthenticated && (
            <button className="btn-primary" onClick={() => openForm()} style={{ marginTop: 16 }}>
              <Plus size={15} /> Agregar primera materia prima
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {items.map((item) => (
              <div key={item.id} className="card" style={{ padding: 16 }}>
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-semibold text-base">{item.name}</h3>
                  <span style={{
                    background: 'var(--accent-light)',
                    color: 'var(--accent)',
                    fontWeight: 700,
                    padding: '3px 10px',
                    borderRadius: 6,
                    fontSize: 12,
                  }}>
                    {item.quantity} {item.unit}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{item.unit}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Costo u.: {item.cost_per_unit != null ? `$${item.cost_per_unit.toFixed(2)}` : '—'}</div>
                  </div>
                  {isAuthenticated && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" onClick={() => openForm(item)} style={{ padding: '6px 12px' }}>
                        <Pencil size={13} />
                      </button>
                      <button className="btn-danger" onClick={() => handleDelete(item.id)} style={{ padding: '6px 12px' }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          
          {/* Desktop Table */}
          <div className="hidden md:block">
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)' }}>
                    {['Nombre', 'Unidad', 'Cantidad', 'Costo u.', isAuthenticated ? 'Acciones' : ''].filter(Boolean).map(h => (
                      <th key={h} style={{
                        textAlign: 'left', padding: '12px 20px',
                        fontSize: 12, fontWeight: 700,
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase', letterSpacing: '0.04em',
                        borderBottom: '1.5px solid var(--border)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={item.id} style={{
                      borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none',
                      transition: 'background 0.1s',
                    }}>
                      <td style={{ padding: '14px 20px', fontWeight: 600 }}>{item.name}</td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>{item.unit}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          background: 'var(--accent-light)',
                          color: 'var(--accent)',
                          fontWeight: 700,
                          padding: '3px 10px',
                          borderRadius: 6,
                          fontSize: 14,
                        }}>
                          {item.quantity} {item.unit}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--text-muted)' }}>
                        {item.cost_per_unit != null ? `$${item.cost_per_unit.toFixed(2)}` : '—'}
                      </td>
                      {isAuthenticated && (
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button className="btn-secondary" onClick={() => openForm(item)} style={{ padding: '6px 12px' }}>
                              <Pencil size={13} />
                            </button>
                            <button className="btn-danger" onClick={() => handleDelete(item.id)} style={{ padding: '6px 12px' }}>
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 420 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px' }}>
              {editing ? 'Editar materia prima' : 'Nueva materia prima'}
            </h2>

            <div className="grid grid-cols-1 gap-4 mb-4">
              <div>
                <label className="label">Nombre</label>
                <input className="input" placeholder="Ej: Harina de trigo" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Unidad de medida</label>
                  <select className="input" value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Cantidad</label>
                  <input className="input" type="number" min="0" step="0.01" placeholder="0"
                    value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="label">Costo por unidad (opcional)</label>
                <input className="input" type="number" min="0" step="0.01" placeholder="Ej: 1.00"
                  value={form.cost_per_unit} onChange={e => setForm({ ...form, cost_per_unit: e.target.value })} />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button className="btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn-primary" onClick={handleSave} disabled={saving || !form.name || !form.quantity}>
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
