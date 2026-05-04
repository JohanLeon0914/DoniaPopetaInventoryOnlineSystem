export interface RawMaterial {
  id: number
  name: string
  unit: string
  quantity: number
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
  created_at: string
  paid: boolean
  paid_at: string | null
  total: number
  items?: OrderItem[]
}

export interface OrderItem {
  id: number
  order_id: number
  product_id: number
  quantity: number
  unit_price: number
  product?: Product
}
