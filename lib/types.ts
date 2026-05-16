export interface RawMaterial {
  id: number
  name: string
  unit: string
  quantity: number
  cost_per_unit?: number
  created_at: string
}

export interface Product {
  id: number
  name: string
  sale_price: number
  created_at: string
  ingredients?: ProductIngredient[]
}

export interface ProductIngredient {
  id: number
  product_id: number
  raw_material_id: number
  quantity: number
  raw_material?: RawMaterial
}

export interface Order {
  id: number
  name?: string
  created_at: string
  paid: boolean
  paid_at: string | null
  total: number
  parent_order_id?: number | null
  items?: OrderItem[]
  combined_orders?: Order[]
}

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  unit_price: number
  product?: Product
}

export interface ProductionRecord {
  id: number
  production_date: string
  notes?: string
  raw_material_cost?: number
  labor_cost?: number
  electricity_cost?: number
  social_security_cost?: number
  total_cost?: number
  created_at: string
  updated_at: string
  items?: ProductionItem[]
  inventory_history?: InventoryHistory[]
}

export interface ProductionItem {
  id: number
  production_record_id: number
  product_id: number
  quantity: number
  created_at: string
  product?: Product
}

export interface InventoryHistory {
  id: number
  production_record_id: number
  raw_material_id: number
  quantity_before: number
  quantity_after: number
  quantity_used: number
  created_at: string
  raw_material?: RawMaterial
}
