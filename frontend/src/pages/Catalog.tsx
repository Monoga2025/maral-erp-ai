import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Grid3X3, Plus, TrendingUp, Pencil, Search, Sparkles, Layers } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { productsApi } from '../lib/api'
import { formatCOP } from '../lib/utils'
import type { Product } from '../types'
import { TourButton } from '../components/tour/TourButton'
import { Hint } from '../components/ui/Hint'
import { EmptyState } from '../components/ui/EmptyState'

const LINES = [
  { key: '', label: 'Todos' },
  { key: 'ESTACION_BASE', label: 'Estación Base' },
  { key: 'MOVIL', label: 'Móvil' },
  { key: 'HANDY', label: 'Handy' },
  { key: 'CABLE', label: 'Cables' },
  { key: 'CONECTOR', label: 'Conectores' },
  { key: 'BASE', label: 'Bases' },
  { key: 'ACCESORIO', label: 'Accesorios' },
]

const LINE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  ESTACION_BASE: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  MOVIL: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  HANDY: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  CABLE: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' },
  CONECTOR: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
  BASE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  ACCESORIO: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
}

export default function Catalog() {
  const navigate = useNavigate()
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['products', category, search],
    queryFn: () =>
      productsApi.getAll({
        category: category || undefined,
        search: search || undefined,
        pageSize: 200,
      }),
  })

  const products: Product[] = data?.data.data ?? []

  const margin = (p: Product) => {
    const price = p.priceList ?? p.price ?? 0
    return price > 0 && p.cost > 0 ? Math.round(((price - p.cost) / price) * 100) : 0
  }

  if (isLoading && !data) {
    return (
      <div className="animate-pulse space-y-4 max-w-7xl mx-auto">
        <div className="h-10 bg-slate-200 rounded-2xl w-64" />
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
              <Layers className="h-3.5 w-3.5 text-blue-600" />
              Catálogo de Fabricación & Distribución
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Catálogo de Productos ({products.length})
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Líneas de antenas, cables, bases y componentes con análisis de costo y margen de utilidad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton tourId="catalogo" />
          <button
            data-tour="new-product-btn"
            onClick={() => navigate('/catalogo/nuevo')}
            className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-all font-bold text-xs shadow-xs active:scale-95"
          >
            <Plus size={15} />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div
        data-tour="catalog-filters"
        className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs"
      >
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, código o referencia..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9 pr-4 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400 w-full sm:w-72 transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 flex-wrap overflow-x-auto">
          {LINES.map((l) => (
            <button
              key={l.key}
              onClick={() => setCategory(l.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                category === l.key
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/80 hover:text-slate-900'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-400">
          <Hint
            text="Verde = margen ≥50% (alta rentabilidad). Azul = ≥30% (estándar). Naranja = <30% (revisar costo)."
            side="left"
          />
          <span className="text-[11px] font-medium">Margen comercial</span>
        </div>
      </div>

      {/* Product Bento Grid */}
      <div
        data-tour="catalog-grid"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        {products.map((p) => {
          const mg = margin(p)
          const isCritical = p.stock < p.minStock
          const lineStyle = LINE_BADGE[p.line ?? ''] ?? {
            bg: 'bg-slate-50',
            text: 'text-slate-700',
            border: 'border-slate-200',
          }

          return (
            <div
              key={p.id}
              onClick={() => navigate(`/catalogo/${p.id}/editar`)}
              className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group relative flex flex-col justify-between"
            >
              {/* Top Action Bar */}
              <div className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <span className="text-[11px] font-mono font-black px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200/60">
                    {p.reference}
                  </span>
                  <div className="flex items-center gap-1">
                    {isCritical && (
                      <span className="text-[10px] bg-red-100 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold">
                        Stock Crítico
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${lineStyle.bg} ${lineStyle.text} ${lineStyle.border}`}
                    >
                      {p.line ? p.line.replace('_', ' ') : 'GENERAL'}
                    </span>
                  </div>
                </div>

                <h3 className="font-bold text-slate-900 text-xs leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                  {p.name}
                </h3>
              </div>

              {/* Specs & Pricing Details */}
              <div className="p-4 pt-0">
                <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-3 bg-slate-50/80 px-2.5 py-1.5 rounded-xl border border-slate-100">
                  <span>Unidad: <strong className="text-slate-800 font-bold">{p.unit}</strong></span>
                  <span className="text-slate-300">·</span>
                  <span>
                    Stock: <strong className={isCritical ? 'text-red-600 font-bold' : 'text-slate-800 font-bold'}>{p.stock}</strong>
                  </span>
                  {p.minStock > 0 && (
                    <span className="text-slate-400 text-[10px]"> (mín: {p.minStock})</span>
                  )}
                </div>

                <div className="space-y-1.5 pt-2 border-t border-slate-100 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 text-[11px]">Precio Lista</span>
                    <span className="font-black text-slate-900 text-sm">
                      {formatCOP(p.priceList ?? p.price ?? 0)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="text-slate-400">Costo</span>
                    <span className="text-slate-600 font-semibold">{formatCOP(p.cost)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1.5 border-t border-slate-100">
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <TrendingUp size={12} className="text-slate-400" />
                      Margen Bruto
                    </span>
                    <span
                      className={`text-xs font-black px-2 py-0.5 rounded-md ${
                        mg >= 50
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/80'
                          : mg >= 30
                          ? 'bg-blue-50 text-blue-700 border border-blue-200/80'
                          : 'bg-amber-50 text-amber-700 border border-amber-200/80'
                      }`}
                    >
                      {mg}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {products.length === 0 && (
        <EmptyState
          icon={<Grid3X3 className="h-8 w-8 text-slate-400" />}
          title="No se encontraron productos"
          description="Intenta cambiar el término de búsqueda o selecciona otra categoría."
          action={{
            label: 'Crear Nuevo Producto',
            onClick: () => navigate('/catalogo/nuevo'),
          }}
        />
      )}
    </div>
  )
}
