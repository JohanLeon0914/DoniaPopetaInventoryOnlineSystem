import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface ProductOption {
  id: number
  name: string
  sale_price: number
}

interface ParsedOrderLine {
  product_id: number
  product_name: string
  quantity: number
}

interface ParsedOrder {
  order_name: string
  lines: ParsedOrderLine[]
}

interface OpenAIOutputContent {
  type?: string
  text?: string
}

interface OpenAIOutputItem {
  content?: OpenAIOutputContent[]
}

interface OpenAIResponsePayload {
  output_text?: string
  output?: OpenAIOutputItem[]
  error?: {
    message?: string
  }
}

const orderSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['order_name', 'lines'],
  properties: {
    order_name: {
      type: 'string',
      description: 'Nombre final del pedido, por ejemplo "Pedido Nelson Viernes 18 de Septiembre".',
    },
    lines: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['product_id', 'product_name', 'quantity'],
        properties: {
          product_id: { type: 'number' },
          product_name: { type: 'string' },
          quantity: { type: 'number', minimum: 1 },
        },
      },
    },
  },
} as const

function normalizeProductName(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function coerceParsedOrder(raw: unknown, products: ProductOption[]): ParsedOrder | null {
  if (!raw || typeof raw !== 'object') return null

  const parsed = raw as Partial<ParsedOrder>
  if (!parsed.order_name || typeof parsed.order_name !== 'string' || !Array.isArray(parsed.lines)) return null

  const productById = new Map(products.map(product => [product.id, product]))
  const lines = parsed.lines
    .map(line => {
      const productId = Number(line.product_id)
      const quantity = Number(line.quantity)
      const product = productById.get(productId)

      if (!product || !Number.isFinite(quantity) || quantity <= 0) return null

      return {
        product_id: product.id,
        product_name: product.name,
        quantity: Math.round(quantity),
      }
    })
    .filter((line): line is ParsedOrderLine => Boolean(line))

  if (lines.length === 0) return null

  return {
    order_name: parsed.order_name.trim(),
    lines,
  }
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'Falta configurar OPENAI_API_KEY en el servidor.' },
      { status: 500 },
    )
  }

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: 'Falta configurar Supabase en el servidor.' },
      { status: 500 },
    )
  }

  const { text } = await request.json().catch(() => ({ text: '' }))
  const rawText = typeof text === 'string' ? text.trim() : ''

  if (!rawText) {
    return NextResponse.json({ error: 'Pega el texto del pedido para interpretarlo.' }, { status: 400 })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)
  const { data: products, error: productError } = await supabase
    .from('products')
    .select('id, name, sale_price')
    .order('name')

  if (productError) {
    return NextResponse.json({ error: 'No se pudieron cargar los productos.' }, { status: 500 })
  }

  const productOptions = (products || []) as ProductOption[]

  if (productOptions.length === 0) {
    return NextResponse.json({ error: 'No hay productos registrados para comparar.' }, { status: 400 })
  }

  const catalog = productOptions.map(product => ({
    id: product.id,
    name: product.name,
    normalized_name: normalizeProductName(product.name),
    sale_price: product.sale_price,
  }))

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-5',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'Eres un asistente que convierte pedidos de Doña Popeta a JSON.',
                'Usa exclusivamente productos del catálogo recibido; nunca inventes product_id.',
                'El texto suele venir como encabezado y luego líneas con cantidad y sabor/producto.',
                'Si el encabezado empieza con "Pedido" y no dice de quién es, agrega "Nelson" justo después de "Pedido".',
                'Si el pedido es de Nelson o Colegios, prioriza productos cuyo nombre contenga "colegio".',
                'Si el pedido menciona SENA, prioriza productos cuyo nombre contenga "sena".',
                'Relaciona sabores por nombre aunque tengan singular, plural, mayúsculas o tildes diferentes.',
                'El nombre del pedido debe conservar la fecha o descripción del encabezado.',
              ].join(' '),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: JSON.stringify({
                pedido: rawText,
                productos_disponibles: catalog,
              }),
            },
          ],
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'parsed_order',
          strict: true,
          schema: orderSchema,
        },
      },
    }),
  })

  const payload = await response.json().catch(() => null) as OpenAIResponsePayload | null

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error?.message || 'OpenAI no pudo interpretar el pedido.' },
      { status: 502 },
    )
  }

  const outputText = typeof payload?.output_text === 'string'
    ? payload.output_text
    : payload?.output?.flatMap(item => item.content || [])
      .find(content => content.type === 'output_text')?.text

  if (!outputText) {
    return NextResponse.json({ error: 'OpenAI no devolvió un JSON válido.' }, { status: 502 })
  }

  let parsedJson: unknown

  try {
    parsedJson = JSON.parse(outputText)
  } catch {
    return NextResponse.json({ error: 'OpenAI devolvió una respuesta que no se pudo leer como JSON.' }, { status: 502 })
  }

  const parsedOrder = coerceParsedOrder(parsedJson, productOptions)

  if (!parsedOrder) {
    return NextResponse.json({ error: 'No se pudo relacionar el pedido con productos existentes.' }, { status: 422 })
  }

  return NextResponse.json({ order: parsedOrder })
}
