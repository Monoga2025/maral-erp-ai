import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CreditCard,
  AlertTriangle,
  Clock,
  TrendingUp,
  Check,
  X,
  Bell,
  Landmark,
  MessageCircle,
  ShieldAlert,
  Search,
} from 'lucide-react'
import { invoicesApi } from '../lib/api'
import { formatCOP, formatDate, getDaysAgo } from '../lib/utils'
import { toast } from 'sonner'
import { TourButton } from '../components/tour/TourButton'
import { Hint } from '../components/ui/Hint'
import { EmptyState } from '../components/ui/EmptyState'

const FACTORING_BADGE: Record<string, string> = {
  ACTIVO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  PENDIENTE: 'bg-amber-100 text-amber-700 border-amber-200',
  INACTIVO: 'bg-slate-100 text-slate-600 border-slate-200',
  APROBADO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  EN_ESTUDIO: 'bg-amber-100 text-amber-700 border-amber-200',
  RECHAZADO: 'bg-red-100 text-red-700 border-red-200',
  NO_APLICA: 'bg-slate-100 text-slate-600 border-slate-200',
}

type FilterTab = 'ALL' | 'OVERDUE' | 'NEAR_DUE' | 'CRITICAL' | 'PAID'

export default function Credit() {
  const qc = useQueryClient()
  const [payingId, setPayingId] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['credit-summary'],
    queryFn: () => invoicesApi.getCreditSummary(),
  })

  const { data: invoicesData, isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices'],
    queryFn: () => invoicesApi.getAll({ pageSize: 100 }),
  })

  const registerPayment = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) =>
      invoicesApi.registerPayment(id, amount),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['invoices'] })
      qc.invalidateQueries({ queryKey: ['credit-summary'] })
      toast.success('Pago registrado exitosamente')
      setPayingId(null)
      setPayAmount('')
    },
    onError: () => toast.error('Error al registrar pago'),
  })

  const summary = summaryData?.data
  const rawInvoices =
    invoicesData?.data?.data ??
    (Array.isArray(invoicesData?.data)
      ? invoicesData.data
      : Array.isArray(invoicesData)
      ? invoicesData
      : [])
  const invoices = Array.isArray(rawInvoices) ? rawInvoices : []

  // Aging Radar Calculations
  const agingStats = useMemo(() => {
    let bracket0_30 = { count: 0, amount: 0 }
    let bracket31_60 = { count: 0, amount: 0 }
    let bracket60Plus = { count: 0, amount: 0 }

    invoices.forEach((inv) => {
      if (inv.status === 'VENCIDA') {
        const days = getDaysAgo(inv.dueDate)
        const amt = Number(inv.amount || 0)
        if (days <= 30) {
          bracket0_30.count++
          bracket0_30.amount += amt
        } else if (days <= 60) {
          bracket31_60.count++
          bracket31_60.amount += amt
        } else {
          bracket60Plus.count++
          bracket60Plus.amount += amt
        }
      }
    })

    return { bracket0_30, bracket31_60, bracket60Plus }
  }, [invoices])

  const nearDue = invoices.filter((inv) => {
    if (inv.status !== 'VIGENTE') return false
    const days = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000)
    return days >= 0 && days <= 3
  })

  useEffect(() => {
    if (nearDue.length > 0 && !invoicesLoading) {
      toast.warning(
        `⚠️ ${nearDue.length} factura${nearDue.length !== 1 ? 's' : ''} vence${
          nearDue.length !== 1 ? 'n' : ''
        } en los próximos 3 días`,
        { duration: 6000, id: 'near-due-alert' }
      )
    }
  }, [invoicesLoading])

  // Filtered invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        !searchQuery ||
        inv.client?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(inv.number).includes(searchQuery)

      if (!matchesSearch) return false

      if (activeTab === 'OVERDUE') return inv.status === 'VENCIDA'
      if (activeTab === 'NEAR_DUE') {
        if (inv.status !== 'VIGENTE') return false
        const days = Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000)
        return days >= 0 && days <= 3
      }
      if (activeTab === 'CRITICAL') {
        return inv.status === 'VENCIDA' && getDaysAgo(inv.dueDate) > 60
      }
      if (activeTab === 'PAID') return inv.status === 'PAGADA'

      return true
    })
  }, [invoices, activeTab, searchQuery])

  if ((summaryLoading && !summaryData) || (invoicesLoading && !invoicesData)) {
    return (
      <div className="animate-pulse space-y-4 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-28 bg-slate-200 rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-slate-200 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
              <Landmark className="h-3.5 w-3.5 text-purple-600" />
              Gestión de Cartera & Factoring
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight mt-1">
            Crédito y Cartera FINANCIA
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Control de cuentas por cobrar, estados de mora y gestión inmediata de recaudo.
          </p>
        </div>
        <TourButton tourId="credito" />
      </div>

      {/* KPI Cards */}
      <div data-tour="credit-kpis" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-200 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 border border-blue-100 rounded-2xl flex items-center justify-center shrink-0">
              <CreditCard size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Cartera Vigente
              </p>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {formatCOP(summary?.totalVigente ?? 0)}
              </p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">Dentro del plazo pactado</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-red-200 p-5 shadow-xs hover:border-red-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-red-50 text-red-600 border border-red-100 rounded-2xl flex items-center justify-center shrink-0">
              <AlertTriangle size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase tracking-wider">
                Cartera Vencida
              </p>
              <p className="text-2xl font-black text-red-600 tracking-tight">
                {formatCOP(summary?.totalVencida ?? 0)}
              </p>
              <p className="text-xs text-red-500 font-medium mt-0.5">Requiere cobro urgente</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-amber-200 p-5 shadow-xs hover:border-amber-300 transition-all">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 bg-amber-50 text-amber-600 border border-amber-100 rounded-2xl flex items-center justify-center shrink-0">
              <Clock size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
                Próximos 7 días
              </p>
              <p className="text-2xl font-black text-amber-600 tracking-tight">
                {formatCOP(summary?.proximaVencer ?? 0)}
              </p>
              <p className="text-xs text-amber-600 font-medium mt-0.5">Por vencer esta semana</p>
            </div>
          </div>
        </div>
      </div>

      {/* 🎯 RADAR DE ENVEJECIMIENTO DE CARTERA */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-indigo-600" />
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">
              Radar de Envejecimiento de Mora (Aging Radar)
            </h2>
          </div>
          <span className="text-xs text-slate-400 font-medium">
            Suma total vencida: <strong>{formatCOP(summary?.totalVencida ?? 0)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="p-4 rounded-xl bg-amber-50/60 border border-amber-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800">1 a 30 días de mora</span>
              <span className="text-xs font-black text-amber-700 bg-amber-200/60 px-2 py-0.5 rounded-full">
                {agingStats.bracket0_30.count} facturas
              </span>
            </div>
            <p className="text-lg font-black text-amber-900 mt-2">
              {formatCOP(agingStats.bracket0_30.amount)}
            </p>
            <p className="text-[11px] text-amber-700/80 mt-0.5">Recordatorio suave por WhatsApp</p>
          </div>

          <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200/80">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-orange-800">31 a 60 días de mora</span>
              <span className="text-xs font-black text-orange-700 bg-orange-200/60 px-2 py-0.5 rounded-full">
                {agingStats.bracket31_60.count} facturas
              </span>
            </div>
            <p className="text-lg font-black text-orange-900 mt-2">
              {formatCOP(agingStats.bracket31_60.amount)}
            </p>
            <p className="text-[11px] text-orange-700/80 mt-0.5">Llamada de acuerdo de pago</p>
          </div>

          <div className="p-4 rounded-xl bg-red-50/80 border border-red-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-800">Más de 60 días (Crítica)</span>
              <span className="text-xs font-black text-red-700 bg-red-200/80 px-2 py-0.5 rounded-full">
                {agingStats.bracket60Plus.count} facturas
              </span>
            </div>
            <p className="text-lg font-black text-red-900 mt-2">
              {formatCOP(agingStats.bracket60Plus.amount)}
            </p>
            <p className="text-[11px] text-red-700/80 mt-0.5">Bloqueo de pedidos a crédito</p>
          </div>
        </div>
      </div>

      {/* Credit Rules (FINANCIA) */}
      <div data-tour="credit-rules" className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
        <h2 className="font-bold text-slate-900 mb-3 flex items-center gap-2 text-sm">
          <TrendingUp size={16} className="text-blue-600" />
          Reglas de Crédito y Factoring FINANCIA
          <Hint
            text="FINANCIA es la entidad de factoring de Maral. Estos son los criterios automáticos que usa para subir o bajar el cupo de crédito."
            side="right"
          />
        </h2>
        <div className="flex items-center gap-6 flex-wrap text-xs">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-emerald-100 text-emerald-800 rounded-full flex items-center justify-center font-black">
              3
            </div>
            <div>
              <span className="font-medium text-slate-600">pagos puntuales</span> →{' '}
              <span className="text-emerald-700 font-bold">Sube cupo</span>
            </div>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-amber-100 text-amber-800 rounded-full flex items-center justify-center font-black">
              1
            </div>
            <div>
              <span className="font-medium text-slate-600">retraso</span> →{' '}
              <span className="text-amber-700 font-bold">Baja cupo</span>
            </div>
          </div>
          <div className="w-px h-5 bg-slate-200" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-red-100 text-red-800 rounded-full flex items-center justify-center font-black">
              2
            </div>
            <div>
              <span className="font-medium text-slate-600">retrasos</span> →{' '}
              <span className="text-red-700 font-bold">Solo contado</span>
            </div>
          </div>
        </div>
      </div>

      {/* Table Section with Filters */}
      <div
        data-tour="credit-invoices"
        className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden"
      >
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-slate-900 text-sm">Facturas por Cobrar</h2>
            <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2 py-0.5 rounded-full">
              {filteredInvoices.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar cliente o #..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 pr-3 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-400 w-44 transition-all"
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl text-xs font-bold">
              <button
                onClick={() => setActiveTab('ALL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'ALL'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setActiveTab('OVERDUE')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'OVERDUE'
                    ? 'bg-white text-red-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Vencidas
              </button>
              <button
                onClick={() => setActiveTab('NEAR_DUE')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'NEAR_DUE'
                    ? 'bg-white text-amber-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Próximas (3d)
              </button>
              <button
                onClick={() => setActiveTab('CRITICAL')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'CRITICAL'
                    ? 'bg-white text-red-700 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Críticas (&gt;60d)
              </button>
              <button
                onClick={() => setActiveTab('PAID')}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  activeTab === 'PAID'
                    ? 'bg-white text-emerald-600 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Pagadas
              </button>
            </div>
          </div>
        </div>

        {filteredInvoices.length === 0 ? (
          <EmptyState
            icon={<CreditCard className="h-8 w-8 text-slate-400" />}
            title="No se encontraron facturas"
            description="No hay registros que coincidan con los filtros o la búsqueda actual."
            action={{
              label: 'Ver todas las facturas',
              onClick: () => {
                setActiveTab('ALL')
                setSearchQuery('')
              },
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-100">
                <tr>
                  {[
                    '# Factura',
                    'Cliente',
                    'Emisión',
                    'Vencimiento',
                    'Monto',
                    'Estado',
                    'Mora',
                    'Acciones',
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left font-bold text-slate-500 uppercase tracking-wider text-[11px]"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => {
                  const isOverdue = inv.status === 'VENCIDA'
                  const daysOverdue = isOverdue ? getDaysAgo(inv.dueDate) : 0
                  const daysUntilDue =
                    inv.status === 'VIGENTE'
                      ? Math.ceil((new Date(inv.dueDate).getTime() - Date.now()) / 86400000)
                      : null
                  const isNearDue =
                    daysUntilDue !== null && daysUntilDue >= 0 && daysUntilDue <= 3

                  return (
                    <tr
                      key={inv.id}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isOverdue
                          ? 'bg-red-50/30'
                          : isNearDue
                          ? 'bg-amber-50/30'
                          : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-black text-slate-900">
                        <Link
                          to={`/facturas/${inv.id}`}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline"
                          title="Ver detalle y estado DIAN"
                        >
                          <Landmark size={12} className="text-slate-400" />
                          #{inv.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900 max-w-[200px] truncate">
                        {inv.client?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(inv.createdAt)}</td>
                      <td
                        className={`px-4 py-3 font-semibold ${
                          isOverdue
                            ? 'text-red-600'
                            : isNearDue
                            ? 'text-amber-600'
                            : 'text-slate-600'
                        }`}
                      >
                        {formatDate(inv.dueDate)}
                        {isNearDue && (
                          <span className="ml-1.5 bg-amber-100 text-amber-800 rounded-full px-1.5 py-0.2 text-[9px] font-bold">
                            Vence en {daysUntilDue}d
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        {formatCOP(inv.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'PAGADA'
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : inv.status === 'VENCIDA'
                              ? 'bg-red-100 text-red-800 border border-red-200'
                              : 'bg-blue-100 text-blue-800 border border-blue-200'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td
                        className={`px-4 py-3 font-black ${
                          daysOverdue > 0 ? 'text-red-600' : 'text-slate-400'
                        }`}
                      >
                        {daysOverdue > 0 ? `${daysOverdue}d mora` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          {inv.status !== 'PAGADA' && (
                            payingId === inv.id ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min="0"
                                  step="1000"
                                  placeholder="Monto"
                                  value={payAmount}
                                  onChange={(e) => setPayAmount(e.target.value)}
                                  className="w-24 border border-slate-200 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:border-blue-400"
                                  autoFocus
                                />
                                <button
                                  onClick={() =>
                                    registerPayment.mutate({
                                      id: inv.id,
                                      amount: parseFloat(payAmount) || 0,
                                    })
                                  }
                                  disabled={!payAmount || parseFloat(payAmount) <= 0}
                                  className="p-1 text-emerald-600 hover:text-emerald-800 disabled:opacity-40"
                                  title="Confirmar pago"
                                >
                                  <Check size={14} />
                                </button>
                                <button
                                  onClick={() => {
                                    setPayingId(null)
                                    setPayAmount('')
                                  }}
                                  className="p-1 text-slate-400 hover:text-slate-600"
                                  title="Cancelar"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setPayingId(inv.id)}
                                className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-xl px-2.5 py-1 hover:bg-blue-100 transition-colors font-bold active:scale-95"
                              >
                                Registrar pago
                              </button>
                            )
                          )}

                          {inv.status !== 'PAGADA' && (
                            <button
                              onClick={() => {
                                const clientPhone =
                                  inv.client?.phone?.replace(/\D/g, '') ||
                                  inv.client?.whatsapp?.replace(/\D/g, '') ||
                                  ''
                                const clientName = inv.client?.name || 'Cliente'
                                const message = encodeURIComponent(
                                  `Hola ${clientName}, cordial saludo de MARAL S.A.S.\n\nLe recordamos amablemente el estado de su Factura #${inv.number} por valor de ${formatCOP(
                                    inv.amount
                                  )} con fecha de vencimiento ${formatDate(
                                    inv.dueDate
                                  )}.\n\nAgradecemos informarnos una vez realizado el pago para actualizar su saldo en sistema. ¡Muchas gracias!`
                                )
                                if (clientPhone) {
                                  window.open(
                                    `https://wa.me/57${clientPhone}?text=${message}`,
                                    '_blank'
                                  )
                                } else {
                                  window.open(`https://wa.me/?text=${message}`, '_blank')
                                }
                                toast.success('Abriendo WhatsApp con recordatorio de pago')
                              }}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl border border-emerald-200 transition-colors active:scale-95"
                              title="Enviar recordatorio de cobro por WhatsApp"
                            >
                              <MessageCircle size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
