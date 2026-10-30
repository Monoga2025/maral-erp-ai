import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState, useRef } from 'react'
import {
  ArrowLeft,
  MessageCircle,
  Plus,
  FileText,
  MapPin,
  Phone,
  Mail,
  Building2,
  CreditCard,
  Pencil,
  Tag,
  X,
  BellOff,
  Clock,
  UserCheck,
  AlertTriangle,
  Send,
  PhoneCall,
  User,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { clientsApi, quotationsApi, ordersApi } from '../lib/api'
import { formatCOP, formatDate } from '../lib/utils'
import { Button } from '../components/ui/Button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/Tabs'
import { ClientCategoryBadge, FactoringStatusBadge, QuotationStatusBadge, OrderStatusBadge } from '../components/ui/StatusBadge'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '../components/ui/Table'
import { PageSkeleton } from '../components/ui/LoadingSkeleton'
import type { QuotationStatus, OrderStatus } from '../types'

const PRESET_TAGS = ['DIPOLOS', 'VHF', 'ANTENAS', 'UHF', 'REPETIDORES', 'ACCESORIOS']

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [tagInput, setTagInput] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [newCallNote, setNewCallNote] = useState('')
  const tagInputRef = useRef<HTMLInputElement>(null)

  const { data: client, isLoading, isError, refetch } = useQuery({
    queryKey: ['client', id],
    queryFn: () => clientsApi.getById(id!).then((r) => r.data),
    enabled: !!id,
  })

  const { data: quotations } = useQuery({
    queryKey: ['quotations', { clientId: id }],
    queryFn: () =>
      quotationsApi.getAll({ clientId: id!, pageSize: 50 }).then((r) => r.data),
    enabled: !!id,
  })

  const { data: orders } = useQuery({
    queryKey: ['orders', { clientId: id }],
    queryFn: () =>
      ordersApi.getAll({ clientId: id!, pageSize: 50 }).then((r) => r.data),
    enabled: !!id,
  })

  const tagsMutation = useMutation({
    mutationFn: (tags: string[]) =>
      clientsApi.update(id!, { interestTags: tags } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      queryClient.invalidateQueries({ queryKey: ['client-tags'] })
    },
  })

  const optOutMutation = useMutation({
    mutationFn: (optedOut: boolean) =>
      clientsApi.update(id!, { optedOut } as any),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['client', id] }),
  })

  const callNoteMutation = useMutation({
    mutationFn: (note: string) => clientsApi.addCallNote(id!, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client', id] })
      setNewCallNote('')
      toast.success('Nota de llamada registrada')
    },
    onError: () => toast.error('Error al registrar nota'),
  })

  const addTag = (tag: string) => {
    const normalized = tag.trim().toUpperCase()
    if (!normalized) return
    const current = client?.interestTags ?? []
    if (current.includes(normalized)) return
    tagsMutation.mutate([...current, normalized])
    setTagInput('')
    setShowSuggestions(false)
  }

  const removeTag = (tag: string) => {
    const current = client?.interestTags ?? []
    tagsMutation.mutate(current.filter((t) => t !== tag))
  }

  if (isLoading) return <PageSkeleton />
  if (isError || !client) return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
      <p className="font-semibold text-red-800">No se pudo cargar el cliente</p>
      <p className="mt-1 text-sm text-red-700">Es posible que el registro no exista o que haya un problema de conexión.</p>
      <div className="mt-4 flex justify-center gap-2">
        <Button variant="outline" onClick={() => navigate('/clientes')}>Volver a clientes</Button>
        <Button onClick={() => refetch()}>Reintentar</Button>
      </div>
    </div>
  )

  const creditPct = client.creditLimit > 0
    ? (client.creditUsed / client.creditLimit) * 100
    : 0

  const daysSinceLastOrder = client.lastOrderAt
    ? Math.floor((Date.now() - new Date(client.lastOrderAt).getTime()) / 86400000)
    : null
  const isChurnRisk = daysSinceLastOrder !== null ? daysSinceLastOrder > 60 : ((client.ordersCount ?? 0) === 0)

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={() => navigate('/clientes')}
        >
          Clientes
        </Button>
        <span className="text-gray-300">/</span>
        <span className="text-sm font-semibold text-gray-900">{client.name}</span>
      </div>

      {/* Client header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-blue-600 text-white text-2xl font-bold">
              {client.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="break-words text-2xl font-bold text-gray-900">{client.name}</h1>
                <ClientCategoryBadge category={client.category} />
                <FactoringStatusBadge status={client.factoringStatus} />
              </div>
              {client.company && (
                <div className="flex items-center gap-1.5 text-gray-600 mb-1">
                  <Building2 className="h-4 w-4 text-gray-400" />
                  <span className="text-sm">{client.company}</span>
                  {client.rut && <span className="text-xs text-gray-400">· RUT: {client.rut}</span>}
                </div>
              )}
              <div className="flex flex-wrap gap-4 mt-2">
                {client.city && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <MapPin className="h-3.5 w-3.5" />
                    {client.city}
                  </div>
                )}
                {client.phone && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Phone className="h-3.5 w-3.5" />
                    {client.phone}
                  </div>
                )}
                {client.email && (
                  <div className="flex items-center gap-1.5 text-sm text-gray-500">
                    <Mail className="h-3.5 w-3.5" />
                    {client.email}
                  </div>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              {(client.whatsapp ?? client.phone) && (
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<MessageCircle className="h-4 w-4 text-green-600" />}
                  onClick={() => {
                    const phone = (client.whatsapp ?? client.phone ?? '').replace(/\D/g, '')
                    window.open(`https://wa.me/57${phone}`, '_blank')
                  }}
                >
                  WhatsApp
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Pencil className="h-4 w-4" />}
                onClick={() => navigate(`/clientes/${client.id}/editar`)}
              >
                Editar
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={<FileText className="h-4 w-4" />}
                onClick={() =>
                  navigate('/cotizaciones/nueva', {
                    state: { clientId: client.id },
                  })
                }
              >
                Nueva Cotización
              </Button>
              <Button
                size="sm"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() =>
                  navigate('/pedidos/nuevo', { state: { clientId: client.id } })
                }
              >
                Nuevo Pedido
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Churn Risk / Inactivity Banner (OBJ-015) */}
      {isChurnRisk && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-semibold text-amber-900">Alerta de Inactividad / Riesgo de Fuga</p>
              <p className="text-xs text-amber-700 mt-0.5">
                {daysSinceLastOrder !== null
                  ? `Este cliente no realiza pedidos hace ${daysSinceLastOrder} días. Se recomienda reactivación comercial.`
                  : 'Este cliente no registra ningún pedido completado aún. Realiza seguimiento comercial.'}
              </p>
            </div>
          </div>
          {(client.whatsapp ?? client.phone) && (
            <Button
              size="sm"
              variant="outline"
              className="bg-white border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
              leftIcon={<MessageCircle className="h-4 w-4 text-green-600" />}
              onClick={() => {
                const phone = (client.whatsapp ?? client.phone ?? '').replace(/\D/g, '')
                const msg = `¡Hola ${client.name}! Te saluda el equipo de Maral Comunicaciones. Queremos saber cómo van tus proyectos y presentarte nuestras nuevas referencias de antenas y accesorios con entrega inmediata.`
                window.open(`https://wa.me/57${phone}?text=${encodeURIComponent(msg)}`, '_blank')
              }}
            >
              Reactivar por WhatsApp
            </Button>
          )}
        </div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Total compras</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {formatCOP(client.totalPurchases ?? 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Pedidos totales</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {client.ordersCount ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Ticket promedio</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {client.ordersCount
                ? formatCOP((client.totalPurchases ?? 0) / client.ordersCount)
                : '—'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium text-gray-500">Último pedido</p>
            <p className="mt-1 text-xl font-bold text-gray-900">
              {client.lastOrderAt ? formatDate(client.lastOrderAt) : '—'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="resumen">
        <TabsList className="flex-wrap">
          <TabsTrigger value="resumen">Resumen</TabsTrigger>
          <TabsTrigger value="cotizaciones">
            Cotizaciones ({quotations?.pagination?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pedidos">
            Pedidos ({orders?.pagination?.total ?? 0})
          </TabsTrigger>
          <TabsTrigger value="credito">Crédito</TabsTrigger>
          <TabsTrigger value="notas">Notas</TabsTrigger>
        </TabsList>

        <TabsContent value="resumen">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Campaign tags card */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Tag className="h-4 w-4 text-gray-500" />
                    Etiquetas de campaña
                  </span>
                  <button
                    onClick={() => optOutMutation.mutate(!client.optedOut)}
                    disabled={optOutMutation.isPending}
                    className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                      client.optedOut
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    }`}
                    title={client.optedOut ? 'Excluido de campañas — click para incluir' : 'Incluido en campañas — click para excluir'}
                  >
                    <BellOff className="h-3 w-3" />
                    {client.optedOut ? 'Excluido de campañas' : 'Incluir en campañas'}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap items-center gap-2 min-h-[36px]">
                  {(client.interestTags ?? []).map((t) => (
                    <span
                      key={t}
                      className="flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold px-2.5 py-1 rounded-full"
                    >
                      {t}
                      <button
                        onClick={() => removeTag(t)}
                        className="ml-0.5 text-blue-400 hover:text-blue-700 transition-colors"
                        disabled={tagsMutation.isPending}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  {/* Add tag input */}
                  <div className="relative">
                    <div className="flex items-center gap-1 border border-dashed border-gray-300 rounded-full px-2.5 py-1 hover:border-blue-400 transition-colors">
                      <Plus className="h-3 w-3 text-gray-400" />
                      <input
                        ref={tagInputRef}
                        value={tagInput}
                        onChange={(e) => {
                          setTagInput(e.target.value.toUpperCase())
                          setShowSuggestions(true)
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addTag(tagInput)
                          if (e.key === 'Escape') {
                            setTagInput('')
                            setShowSuggestions(false)
                          }
                        }}
                        placeholder="Agregar etiqueta"
                        className="text-xs w-28 bg-transparent outline-none placeholder-gray-400 text-gray-700"
                      />
                    </div>
                    {showSuggestions && (
                      <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                        {PRESET_TAGS.filter(
                          (t) =>
                            (!tagInput || t.includes(tagInput)) &&
                            !(client.interestTags ?? []).includes(t)
                        ).map((t) => (
                          <button
                            key={t}
                            onMouseDown={() => addTag(t)}
                            className="w-full text-left text-xs px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-gray-700"
                          >
                            {t}
                          </button>
                        ))}
                        {tagInput && !PRESET_TAGS.includes(tagInput) && (
                          <button
                            onMouseDown={() => addTag(tagInput)}
                            className="w-full text-left text-xs px-3 py-1.5 hover:bg-blue-50 hover:text-blue-700 text-gray-500 border-t border-gray-100"
                          >
                            + Crear "{tagInput}"
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                {(client.interestTags ?? []).length === 0 && (
                  <p className="text-xs text-gray-400 mt-2">
                    Sin etiquetas. Agrega "DIPOLOS" para incluir en la campaña VHF.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Additional Contacts Card (OBJ-016) */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-gray-500" />
                  Contactos Clave de la Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dueño / Gerente</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{client.ownerName || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Compras / Adquisiciones</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{client.purchaseContactName || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Secretaría / Recepción</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{client.secretaryName || '—'}</p>
                  </div>
                  <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Contacto Adicional</p>
                    <p className="text-sm font-bold text-gray-900 mt-1">{client.otherContactName || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Información de contacto</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2.5">
                  {[
                    { label: 'Nombre', value: client.name },
                    { label: 'Empresa', value: client.company },
                    { label: 'RUT', value: client.rut },
                    { label: 'Email', value: client.email },
                    { label: 'Teléfono', value: client.phone },
                    { label: 'WhatsApp', value: client.whatsapp },
                    { label: 'Ciudad', value: client.city },
                    { label: 'Dirección', value: client.address },
                  ].map(
                    (item) =>
                      item.value && (
                        <div key={item.label} className="flex justify-between text-sm">
                          <dt className="text-gray-500">{item.label}</dt>
                          <dd className="font-medium text-gray-900 text-right">
                            {item.value}
                          </dd>
                        </div>
                      )
                  )}
                  {(client.previousNames ?? []).length > 0 && (
                    <div className="pt-2 border-t border-gray-100 text-sm">
                      <dt className="text-gray-500 mb-1">Nombres anteriores</dt>
                      <dd className="flex flex-wrap gap-1">
                        {client.previousNames!.map((name) => (
                          <span key={name} className="rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-xs font-medium text-amber-700">
                            {name}
                          </span>
                        ))}
                      </dd>
                    </div>
                  )}
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-gray-500" />
                  Condiciones comerciales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="space-y-2.5">
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Categoría</dt>
                    <dd>
                      <ClientCategoryBadge category={client.category} />
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Cupo de crédito</dt>
                    <dd className="font-semibold text-gray-900">
                      {formatCOP(client.creditLimit)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Crédito usado</dt>
                    <dd className="font-semibold text-red-600">
                      {formatCOP(client.creditUsed)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Disponible</dt>
                    <dd className="font-semibold text-green-600">
                      {formatCOP(Math.max(0, client.creditLimit - client.creditUsed))}
                    </dd>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all ${creditPct > 90 ? 'bg-red-500' : creditPct > 70 ? 'bg-orange-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(creditPct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Días de pago</dt>
                    <dd className="font-semibold text-gray-900">
                      {client.paymentDays} días
                    </dd>
                  </div>
                  <div className="flex justify-between text-sm">
                    <dt className="text-gray-500">Factoring</dt>
                    <dd>
                      <FactoringStatusBadge status={client.factoringStatus} />
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cotizaciones">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Válida hasta</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quotations?.data?.map((q) => (
                  <TableRow
                    key={q.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/cotizaciones/${q.id}`)}
                  >
                    <TableCell className="font-medium">{q.number}</TableCell>
                    <TableCell>{formatDate(q.createdAt)}</TableCell>
                    <TableCell>{formatDate(q.validUntil)}</TableCell>
                    <TableCell className="font-semibold">{formatCOP(q.total)}</TableCell>
                    <TableCell>
                      <QuotationStatusBadge status={q.status as QuotationStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="pedidos">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Número</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.data?.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/pedidos/${o.id}`)}
                  >
                    <TableCell className="font-medium">{o.number}</TableCell>
                    <TableCell>{formatDate(o.createdAt)}</TableCell>
                    <TableCell className="font-semibold">{formatCOP(o.total)}</TableCell>
                    <TableCell>
                      <OrderStatusBadge status={o.status as OrderStatus} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="credito">
          <Card>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl bg-blue-50 p-4">
                  <p className="text-xs font-medium text-blue-600">Cupo total</p>
                  <p className="mt-1 text-xl font-bold text-blue-700">
                    {formatCOP(client.creditLimit)}
                  </p>
                </div>
                <div className="rounded-xl bg-red-50 p-4">
                  <p className="text-xs font-medium text-red-600">Usado</p>
                  <p className="mt-1 text-xl font-bold text-red-700">
                    {formatCOP(client.creditUsed)}
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 p-4">
                  <p className="text-xs font-medium text-green-600">Disponible</p>
                  <p className="mt-1 text-xl font-bold text-green-700">
                    {formatCOP(Math.max(0, client.creditLimit - client.creditUsed))}
                  </p>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Días de pago acordados</span>
                  <span className="font-medium">{client.paymentDays} días</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estado factoring</span>
                  <FactoringStatusBadge status={client.factoringStatus} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notas">
          <div className="space-y-4">
            {/* Form to add new call note (OBJ-013) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <PhoneCall className="h-4 w-4 text-blue-600" />
                  Registrar Nota de Llamada / Bitácora de Seguimiento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!newCallNote.trim()) return
                    callNoteMutation.mutate(newCallNote)
                  }}
                  className="space-y-3"
                >
                  <textarea
                    rows={3}
                    value={newCallNote}
                    onChange={(e) => setNewCallNote(e.target.value)}
                    placeholder="Ej. Se llamó a Don Carlos. Solicita cotización de 5 dipolos VHF para la próxima semana..."
                    className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={!newCallNote.trim() || callNoteMutation.isPending}
                      leftIcon={<Send className="h-4 w-4" />}
                    >
                      {callNoteMutation.isPending ? 'Guardando...' : 'Guardar en Bitácora'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Timeline of call notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-gray-500" />
                  Historial Cronológico de Llamadas y Bitácora
                </CardTitle>
              </CardHeader>
              <CardContent>
                {client.callNotes ? (
                  <div className="space-y-3">
                    {client.callNotes.split('\n\n').filter(Boolean).map((entry, idx) => (
                      <div key={idx} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4 text-sm text-gray-800 space-y-1">
                        <div className="flex items-center gap-2 text-xs font-semibold text-blue-600">
                          <Clock className="h-3.5 w-3.5" />
                          <span>Entrada #{idx + 1}</span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-gray-700">{entry}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-6">
                    Sin historial de llamadas registrado. Registra la primera nota arriba.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* General notes card */}
            {client.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm text-gray-700">Notas Generales de la Ficha</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-600 whitespace-pre-wrap">{client.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
