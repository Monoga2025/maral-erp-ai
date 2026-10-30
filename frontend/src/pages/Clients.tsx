import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Users,
  MessageCircle,
  Eye,
  Filter,
  Tag,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import { categoriesApi, clientsApi, segmentsApi, tagsApi } from '../lib/api'
import { formatDate, formatCOP } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { TourButton } from '../components/tour/TourButton'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/Table'
import { FactoringStatusBadge } from '../components/ui/StatusBadge'
import { Pagination } from '../components/ui/Pagination'
import { EmptyState } from '../components/ui/EmptyState'
import { TableSkeleton } from '../components/ui/LoadingSkeleton'
import { Card } from '../components/ui/Card'
import { Tabs, TabsList, TabsTrigger } from '../components/ui/Tabs'
import type { PurchaseFrequency } from '../types'

const ACTIVITY_TABS = [
  { value: 'all', label: 'Todos' },
  { value: 'active', label: 'Activos (<30d)' },
  { value: 'risk', label: 'En Riesgo (30-60d)' },
  { value: 'inactive', label: 'Inactivos (>60d)' },
  { value: 'no_orders', label: 'Sin Pedidos' },
]

function getClientActivity(lastOrders?: string[]) {
  if (!lastOrders || lastOrders.length === 0) {
    return { status: 'no_orders', label: 'Sin pedidos', color: 'text-gray-500 bg-gray-100 border-gray-200' }
  }
  const days = Math.floor((Date.now() - new Date(lastOrders[0]).getTime()) / 86400000)
  if (days <= 30) {
    return { status: 'active', label: `Activo · ${days}d`, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
  }
  if (days <= 60) {
    return { status: 'risk', label: `Riesgo · ${days}d`, color: 'text-amber-700 bg-amber-50 border-amber-200' }
  }
  return { status: 'inactive', label: `Inactivo · ${days}d`, color: 'text-rose-700 bg-rose-50 border-rose-200' }
}

const SEGMENT_COLORS: Record<string, string> = {
  IM: 'bg-blue-100 text-blue-700 border-blue-200',
  DS: 'bg-purple-100 text-purple-700 border-purple-200',
  CF: 'bg-green-100 text-green-700 border-green-200',
}

const FREQ_LABELS: Record<PurchaseFrequency, string> = {
  FRECUENTE: 'Frecuente',
  INTERMITENTE: 'Intermitente',
  ESPORADICA: 'Esporádica',
  NINGUNA: '—',
}

const FREQ_COLORS: Record<PurchaseFrequency, string> = {
  FRECUENTE: 'bg-green-100 text-green-700',
  INTERMITENTE: 'bg-yellow-100 text-yellow-700',
  ESPORADICA: 'bg-orange-100 text-orange-700',
  NINGUNA: 'text-gray-400',
}

function SegmentBadge({ segment, segments }: { segment?: string | null; segments?: { code: string; name: string; color?: string }[] }) {
  if (!segment) return <span className="text-gray-400 text-xs">—</span>
  const found = segments?.find((s) => s.code === segment)
  return (
    <span
      className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${found?.color ? '' : SEGMENT_COLORS[segment] ?? 'bg-gray-100 text-gray-600'}`}
      style={found?.color ? { backgroundColor: `${found.color}20`, color: found.color, borderColor: `${found.color}55` } : undefined}
    >
      {found ? `${found.code} — ${found.name}` : segment}
    </span>
  )
}

function LastOrdersDots({ dates }: { dates?: string[] }) {
  if (!dates || dates.length === 0) return <span className="text-gray-400 text-xs">Sin pedidos</span>
  return (
    <div className="space-y-0.5">
      {dates.map((d, i) => {
        const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000)
        const color = days <= 30 ? 'text-green-600' : days <= 90 ? 'text-amber-600' : 'text-red-500'
        return (
          <p key={i} className={`text-xs ${color}`}>
            {formatDate(d)}
          </p>
        )
      })}
    </div>
  )
}

const FALLBACK_CATEGORIES = [
  { id: 'IMPORTADOR',        code: 'IMPORTADOR',        name: 'Importador (IM)' },
  { id: 'DISTRIBUIDOR',      code: 'DISTRIBUIDOR',      name: 'Distribuidor (DS)' },
  { id: 'CLIENTE_FINAL',     code: 'CLIENTE_FINAL',     name: 'Cliente Final (CF)' },
  { id: 'PROSPECTO',         code: 'PROSPECTO',         name: 'Prospecto' },
  { id: 'ALIADO',            code: 'ALIADO',            name: 'Aliado' },
  { id: 'FUNDADOR_HISTORICO',code: 'FUNDADOR_HISTORICO',name: 'Fundador Histórico' },
  { id: 'FUNDADOR_MARAL',    code: 'FUNDADOR_MARAL',    name: 'Fundador Maral' },
]

export default function Clients() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [city, setCity] = useState('')
  const [tag, setTag] = useState('')
  const [segmentFilter, setSegmentFilter] = useState('')
  const [activityTab, setActivityTab] = useState('all')
  const [page, setPage] = useState(1)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkSegment, setBulkSegment] = useState<string>('')
  const [bulkTagId, setBulkTagId] = useState<string>('')

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['clients', { search, category, city, tag, segmentFilter, page }],
    queryFn: () =>
      clientsApi
        .getAll({ search: search || undefined, category: category || undefined, city: city || undefined, tagId: tag || undefined, segment: segmentFilter || undefined, page, pageSize: 20 })
        .then((r) => r.data),
    staleTime: 30_000,
  })

  const { data: cities } = useQuery({
    queryKey: ['client-cities'],
    queryFn: () => clientsApi.getCities().then((r) => r.data as string[]),
    staleTime: 300_000,
  })

  const { data: allTagEntities = [] } = useQuery<{ id: string; name: string; color: string }[]>({
    queryKey: ['tags'],
    queryFn: () => tagsApi.getAll().then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: allSegments = [] } = useQuery<{ id: string; code: string; name: string; color?: string; discount?: number }[]>({
    queryKey: ['segments'],
    queryFn: () => segmentsApi.getAll().then((r) => r.data),
    staleTime: 60_000,
  })

  const { data: allCategories = [] } = useQuery<{ id: string; code: string; name: string; color?: string }[]>({
    queryKey: ['categories'],
    queryFn: () => categoriesApi.getAll().then((r) => r.data),
    staleTime: 60_000,
  })

  const bulkSegmentMutation = useMutation({
    mutationFn: ({ ids, segment }: { ids: string[]; segment: string | null }) =>
      clientsApi.bulkSegment(ids, segment),
    onSuccess: (res) => {
      toast.success(`${res.data.updated} clientes actualizados`)
      setSelectedIds(new Set())
      setBulkSegment('')
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: () => toast.error('Error al actualizar segmentos'),
  })

  const categoryMutation = useMutation({
    mutationFn: ({ id, category }: { id: string; category: string }) =>
      clientsApi.update(id, { category }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['clients'] })
      toast.success('Categoría actualizada')
    },
    onError: () => toast.error('Error al actualizar categoría'),
  })

  const bulkTagMutation = useMutation({
    mutationFn: ({ ids, tagId }: { ids: string[]; tagId: string }) =>
      tagsApi.bulkAssign(ids, [tagId], 'add'),
    onSuccess: () => {
      toast.success(`Etiqueta asignada a ${selectedIds.size} clientes`)
      setSelectedIds(new Set())
      setBulkTagId('')
      qc.invalidateQueries({ queryKey: ['clients'] })
    },
    onError: () => toast.error('Error al asignar etiqueta'),
  })

  const rawClients = data?.data ?? []
  const clients = rawClients.filter((c) => {
    if (activityTab === 'all') return true
    const act = getClientActivity(c.lastOrders)
    return act.status === activityTab
  })
  const pageIds = clients.map((c) => c.id)

  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id))
  const someSelected = selectedIds.size > 0

  const toggleAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pageIds.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        pageIds.forEach((id) => next.add(id))
        return next
      })
    }
  }

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const applyBulkSegment = () => {
    const ids = Array.from(selectedIds)
    const segment = bulkSegment === 'NINGUNA' ? null : bulkSegment
    bulkSegmentMutation.mutate({ ids, segment })
  }

  const handleWhatsApp = (client: any, e: React.MouseEvent) => {
    e.stopPropagation()
    const phone = client.whatsapp ?? client.phone
    if (!phone) return
    const clean = phone.replace(/\D/g, '')
    const act = getClientActivity(client.lastOrders)
    let text = `¡Hola ${client.name}! Te saluda el equipo de Maral Comunicaciones.`
    if (act.status === 'inactive' || act.status === 'risk') {
      text = `¡Hola ${client.name}! Esperamos que todo marche excelente. Te contactamos de Maral Comunicaciones para saludarte y compartirte nuestras referencias en stock con despacho inmediato para tu empresa.`
    }
    window.open(`https://wa.me/57${clean}?text=${encodeURIComponent(text)}`, '_blank')
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {data?.pagination?.total ?? 0} clientes registrados
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TourButton tourId="clientes" />
          <Button
            data-tour="new-client-btn"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => navigate('/clientes/nuevo')}
          >
            Nuevo Cliente
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <div className="p-4 space-y-3">
          <Tabs
            defaultValue="all"
            value={activityTab}
            onValueChange={(v) => {
              setActivityTab(v)
              setPage(1)
            }}
          >
            <TabsList className="flex-wrap">
              {ACTIVITY_TABS.map((tab) => (
                <TabsTrigger key={tab.value} value={tab.value}>
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="grid grid-cols-1 gap-3 pt-3 border-t border-gray-100 sm:grid-cols-2 xl:grid-cols-[auto_minmax(220px,1fr)_repeat(4,minmax(150px,auto))] items-center">
            <Filter className="hidden h-4 w-4 text-gray-400 sm:block" />
            <div className="min-w-0">
              <Input
                data-tour="client-search"
                placeholder="Buscar por nombre, empresa, RUT..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                prefix={<Search className="h-4 w-4" />}
              />
            </div>
            <Select value={category} onChange={(e) => { setCategory(e.target.value); setPage(1) }} className="w-full">
              <option value="">Todas las categorías</option>
              {allCategories.map((cat) => (
                <option key={cat.code} value={cat.code}>{cat.name}</option>
              ))}
            </Select>
            <Select value={segmentFilter} onChange={(e) => { setSegmentFilter(e.target.value); setPage(1) }} className="w-full">
              <option value="">Todos los segmentos</option>
              {allSegments.map((seg) => (
                <option key={seg.code} value={seg.code}>{seg.code} — {seg.name}</option>
              ))}
            </Select>
            <Select value={city} onChange={(e) => { setCity(e.target.value); setPage(1) }} className="w-full">
              <option value="">Todas las ciudades</option>
              {(cities ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </Select>
            <Select value={tag} onChange={(e) => { setTag(e.target.value); setPage(1) }} className="w-full">
              <option value="">Todas las etiquetas</option>
              {allTagEntities.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {/* Bulk action bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <span className="text-sm font-semibold text-blue-800">
            {selectedIds.size} cliente{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            {/* Asignar etiqueta */}
            {allTagEntities.length > 0 && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-blue-600 shrink-0" />
                <select
                  value={bulkTagId}
                  onChange={(e) => setBulkTagId(e.target.value)}
                  className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Asignar etiqueta…</option>
                  {allTagEntities.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  disabled={!bulkTagId || bulkTagMutation.isPending}
                  onClick={() => bulkTagMutation.mutate({ ids: Array.from(selectedIds), tagId: bulkTagId })}
                >
                  {bulkTagMutation.isPending ? 'Asignando…' : 'Asignar'}
                </Button>
              </div>
            )}
            {/* Separador */}
            <div className="h-6 w-px bg-blue-200" />
            {/* Asignar segmento */}
            <div className="flex items-center gap-2">
              <select
                value={bulkSegment}
                onChange={(e) => setBulkSegment(e.target.value)}
                className="rounded-lg border border-blue-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Asignar segmento…</option>
                {allSegments.map((seg) => (
                  <option key={seg.code} value={seg.code}>{seg.code} — {seg.name}{seg.discount ? ` (${seg.discount}% dto.)` : ''}</option>
                ))}
                <option value="NINGUNA">Sin segmento</option>
              </select>
              <Button
                size="sm"
                disabled={!bulkSegment || bulkSegmentMutation.isPending}
                onClick={applyBulkSegment}
              >
                {bulkSegmentMutation.isPending ? 'Aplicando…' : 'Aplicar'}
              </Button>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="ml-1 rounded-lg p-1.5 text-blue-500 hover:bg-blue-100 transition-colors"
              title="Cancelar selección"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <Card data-tour="client-list" className="overflow-hidden">
        {isLoading ? (
          <TableSkeleton rows={8} />
        ) : isError ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No se pudieron cargar los clientes" description="Verifica tu conexión e intenta de nuevo." action={{ label: 'Reintentar', onClick: () => refetch() }} />
        ) : !clients.length ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="No se encontraron clientes"
            description="Ajusta los filtros o crea un nuevo cliente"
            action={{ label: 'Nuevo Cliente', onClick: () => navigate('/clientes/nuevo') }}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={toggleAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      title={allPageSelected ? 'Deseleccionar todos' : 'Seleccionar todos en esta página'}
                    />
                  </TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1">
                      <Tag className="h-3.5 w-3.5 text-gray-400" />
                      Segmento
                    </span>
                  </TableHead>
                  <TableHead><Tag className="h-3.5 w-3.5 inline mr-1 text-gray-400" />Etiquetas</TableHead>
                  <TableHead>Frecuencia</TableHead>
                  <TableHead>Últimos pedidos</TableHead>
                  <TableHead>Crédito</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const freq = (client.purchaseFrequency ?? 'NINGUNA') as PurchaseFrequency
                  const isSelected = selectedIds.has(client.id)
                  return (
                    <TableRow
                      key={client.id}
                      className={`cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
                      onClick={() => navigate(`/clientes/${client.id}`)}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleOne(client.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900">{client.name}</p>
                            {(() => {
                              const act = getClientActivity(client.lastOrders)
                              return (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${act.color}`}>
                                  {act.label}
                                </span>
                              )
                            })()}
                          </div>
                          {client.rut && (
                            <p className="text-xs text-gray-400">NIT: {client.rut}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">{client.company ?? '—'}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-gray-600">{client.city ?? '—'}</span>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <select
                          value={client.category}
                          onChange={(e) => categoryMutation.mutate({ id: client.id, category: e.target.value })}
                          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          title="Cambiar categoría"
                        >
                          {(allCategories.length > 0 ? allCategories : FALLBACK_CATEGORIES).map((cat) => (
                            <option key={cat.code} value={cat.code}>{cat.name}</option>
                          ))}
                        </select>
                      </TableCell>
                      <TableCell>
                        <SegmentBadge segment={(client as any).segment} segments={allSegments} />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {((client as any).tags ?? []).slice(0, 3).map((t: { id: string; name: string; color: string }) => (
                            <span
                              key={t.id}
                              className="text-xs px-1.5 py-0.5 rounded-full font-medium border"
                              style={{ backgroundColor: t.color + '20', color: t.color, borderColor: t.color + '40' }}
                            >
                              {t.name}
                            </span>
                          ))}
                          {((client as any).tags ?? []).length > 3 && (
                            <span className="text-xs text-gray-400">+{((client as any).tags ?? []).length - 3}</span>
                          )}
                          {((client as any).tags ?? []).length === 0 && (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {freq !== 'NINGUNA' ? (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${FREQ_COLORS[freq]}`}>
                            {FREQ_LABELS[freq]}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <LastOrdersDots dates={client.lastOrders} />
                      </TableCell>
                      <TableCell>
                        <div>
                          <FactoringStatusBadge status={client.factoringStatus} />
                          <p className="text-xs text-gray-400 mt-0.5">
                            Cupo: {formatCOP(client.creditLimit)}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1.5">
                          {(client.whatsapp ?? client.phone) && (
                            <button
                              onClick={(e) => handleWhatsApp(client, e)}
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-green-600 hover:bg-green-50 hover:border-green-200 transition-colors"
                              title="Contactar por WhatsApp"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); navigate(`/clientes/${client.id}`) }}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            </div>
            <Pagination
              page={page}
              totalPages={data!.pagination.pages}
              total={data!.pagination.total}
              pageSize={20}
              onPageChange={setPage}
            />
          </>
        )}
      </Card>
    </div>
  )
}
