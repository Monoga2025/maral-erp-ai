import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Menu,
  Search,
  Bell,
  AlertTriangle,
  Clock,
  Package,
  ChevronRight,
  X,
  Plus,
  FileText,
  Users,
  Receipt,
  CheckSquare,
  Sparkles,
} from 'lucide-react'
import { cn, getInitials, formatCOP } from '../../lib/utils'
import { useAuthStore } from '../../store/auth'
import { useUIStore } from '../../store/ui'
import { dashboardApi } from '../../lib/api'

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/clientes': 'Clientes',
  '/clientes/nuevo': 'Nuevo Cliente',
  '/cotizaciones': 'Cotizaciones',
  '/cotizaciones/nueva': 'Nueva Cotización',
  '/pedidos': 'Pedidos',
  '/pedidos/nuevo': 'Nuevo Pedido',
  '/inventario': 'Inventario',
  '/produccion': 'Producción',
  '/compras': 'Compras',
  '/credito': 'Crédito',
  '/catalogo': 'Catálogo',
  '/reportes': 'Reportes',
  '/configuracion': 'Configuración',
  '/gastos': 'Gastos',
  '/tareas': 'Tareas',
  '/whatsapp': 'WhatsApp',
  '/campanas': 'Campañas',
}

const roleStyles: Record<
  string,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  GERENTE: {
    label: 'Gerente',
    bg: 'bg-indigo-50/80',
    text: 'text-indigo-700',
    border: 'border-indigo-200/80',
    dot: 'bg-indigo-500',
  },
  VENTAS: {
    label: 'Ventas',
    bg: 'bg-emerald-50/80',
    text: 'text-emerald-700',
    border: 'border-emerald-200/80',
    dot: 'bg-emerald-500',
  },
  LOGISTICA: {
    label: 'Logística',
    bg: 'bg-amber-50/80',
    text: 'text-amber-700',
    border: 'border-amber-200/80',
    dot: 'bg-amber-500',
  },
  CONTADORA: {
    label: 'Contadora',
    bg: 'bg-purple-50/80',
    text: 'text-purple-700',
    border: 'border-purple-200/80',
    dot: 'bg-purple-500',
  },
}

function getBreadcrumb(pathname: string): { label: string; path: string }[] {
  const crumbs: { label: string; path: string }[] = [{ label: 'MARAL OS', path: '/' }]

  const parts = pathname.split('/').filter(Boolean)
  let currentPath = ''

  for (const part of parts) {
    currentPath += '/' + part
    const label = routeLabels[currentPath] ?? (part.length >= 20 ? 'Detalle' : part)
    crumbs.push({ label, path: currentPath })
  }

  return crumbs
}

export function Header() {
  const { user } = useAuthStore()
  const {
    toggleSidebar,
    toggleCommandPalette,
    notificationsOpen,
    toggleNotifications,
    setNotificationsOpen,
  } = useUIStore()
  const location = useLocation()
  const navigate = useNavigate()
  const breadcrumbs = getBreadcrumb(location.pathname)
  const bellRef = useRef<HTMLDivElement>(null)
  const quickCreateRef = useRef<HTMLDivElement>(null)
  const [quickCreateOpen, setQuickCreateOpen] = useState(false)

  // Fetch dashboard data for live alerts (shared cache with Dashboard)
  const { data: kpis } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => dashboardApi.getSummary().then((r) => r.data),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  })

  // Close notifications or quick create on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        notificationsOpen &&
        bellRef.current &&
        !bellRef.current.contains(e.target as Node)
      ) {
        setNotificationsOpen(false)
      }
      if (
        quickCreateOpen &&
        quickCreateRef.current &&
        !quickCreateRef.current.contains(e.target as Node)
      ) {
        setQuickCreateOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [notificationsOpen, quickCreateOpen, setNotificationsOpen])

  // Global keyboard shortcuts (N for quick create, ⌘K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return
      }

      if (e.key === 'n' || e.key === 'N') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault()
          setQuickCreateOpen((prev) => !prev)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Dynamic system alerts
  const alerts = [
    (kpis?.overdueReceivables ?? 0) > 0 && {
      id: 'cartera',
      icon: <AlertTriangle className="h-4 w-4 text-red-500" />,
      bg: 'bg-red-50',
      title: 'Cartera vencida',
      desc: `${formatCOP(kpis?.overdueReceivables ?? 0)} en facturas por cobrar`,
      path: '/credito',
    },
    (kpis?.overdueFollowUps ?? 0) > 0 && {
      id: 'seguimientos',
      icon: <Clock className="h-4 w-4 text-orange-500" />,
      bg: 'bg-orange-50',
      title: 'Seguimientos vencidos',
      desc: `${kpis?.overdueFollowUps} cotizaciones sin respuesta`,
      path: '/cotizaciones',
    },
    (kpis?.criticalStock ?? 0) > 0 && {
      id: 'stock',
      icon: <Package className="h-4 w-4 text-yellow-600" />,
      bg: 'bg-yellow-50',
      title: 'Stock crítico',
      desc: `${kpis?.criticalStock} productos por debajo del mínimo`,
      path: '/inventario',
    },
  ].filter(Boolean) as {
    id: string
    icon: React.ReactNode
    bg: string
    title: string
    desc: string
    path: string
  }[]

  const alertCount = alerts.length

  const goAlert = (path: string) => {
    navigate(path)
    setNotificationsOpen(false)
  }

  const roleMeta = roleStyles[user?.role || 'GERENTE'] || {
    label: user?.role || 'Usuario',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  }

  const quickCreateActions = [
    {
      label: 'Nueva Cotización',
      desc: 'Generar cotización flash comercial',
      icon: <FileText className="h-4 w-4 text-blue-600" />,
      path: '/cotizaciones/nueva',
      roles: ['GERENTE', 'VENTAS'],
    },
    {
      label: 'Nuevo Pedido',
      desc: 'Crear orden de despacho y taller',
      icon: <Package className="h-4 w-4 text-indigo-600" />,
      path: '/pedidos/nuevo',
      roles: ['GERENTE', 'VENTAS', 'LOGISTICA'],
    },
    {
      label: 'Nuevo Cliente',
      desc: 'Registrar prospecto o distribuidor',
      icon: <Users className="h-4 w-4 text-emerald-600" />,
      path: '/clientes/nuevo',
      roles: ['GERENTE', 'VENTAS'],
    },
    {
      label: 'Nuevo Gasto',
      desc: 'Registrar salida de caja menor',
      icon: <Receipt className="h-4 w-4 text-amber-600" />,
      path: '/gastos',
      roles: ['GERENTE', 'CONTADORA'],
    },
    {
      label: 'Nueva Tarea',
      desc: 'Asignar tarea prioritaria en Kanban',
      icon: <CheckSquare className="h-4 w-4 text-purple-600" />,
      path: '/tareas',
      roles: ['GERENTE', 'VENTAS', 'LOGISTICA', 'CONTADORA'],
    },
  ].filter((a) => !a.roles || a.roles.includes(user?.role || 'GERENTE'))

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-md px-4 transition-all">
      <button
        onClick={toggleSidebar}
        className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors active:scale-95"
        title="Alternar menú lateral"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Breadcrumb Navigation */}
      <nav className="flex items-center gap-1.5 text-xs sm:text-sm flex-1 min-w-0">
        {breadcrumbs.map((crumb, i) => (
          <span key={crumb.path} className="flex items-center gap-1.5 truncate">
            {i > 0 && <span className="text-slate-300">/</span>}
            <span
              onClick={() => i < breadcrumbs.length - 1 && navigate(crumb.path)}
              className={cn(
                'truncate transition-colors',
                i === breadcrumbs.length - 1
                  ? 'font-bold text-slate-900'
                  : 'text-slate-400 hover:text-slate-600 cursor-pointer'
              )}
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Quick Action Button (+ Crear) */}
      <div ref={quickCreateRef} className="relative hidden sm:block">
        <button
          onClick={() => setQuickCreateOpen((prev) => !prev)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 active:scale-95 transition-all"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Crear</span>
          <kbd className="ml-1 rounded bg-slate-800 px-1 py-0.2 text-[9px] font-semibold text-slate-300">
            N
          </kbd>
        </button>

        {quickCreateOpen && (
          <div className="absolute left-0 mt-2 z-50 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in slide-in-from-top-2">
            <div className="px-3 py-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <Sparkles className="h-3 w-3 text-amber-500" />
                <span>Acciones Rápidas</span>
              </div>
            </div>
            <div className="mt-1 space-y-0.5">
              {quickCreateActions.map((action) => (
                <button
                  key={action.path}
                  onClick={() => {
                    navigate(action.path)
                    setQuickCreateOpen(false)
                  }}
                  className="flex w-full items-start gap-2.5 rounded-xl px-3 py-2 text-left hover:bg-slate-50 transition-colors"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100">
                    {action.icon}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-slate-900">{action.label}</p>
                    <p className="text-[11px] text-slate-400 leading-tight">{action.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Global Search Button */}
      <button
        onClick={toggleCommandPalette}
        className="flex h-9 w-44 sm:w-60 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 text-xs text-slate-400 hover:border-blue-300 hover:bg-white transition-all shadow-2xs"
      >
        <Search className="h-3.5 w-3.5 text-slate-400" />
        <span className="truncate">Buscar clientes, pedidos...</span>
        <kbd className="ml-auto hidden sm:inline-block rounded-md bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
          ⌘K
        </kbd>
      </button>

      {/* Notifications Bell */}
      <div ref={bellRef} className="relative">
        <button
          onClick={toggleNotifications}
          className={cn(
            'relative rounded-xl p-2 transition-colors active:scale-95',
            notificationsOpen
              ? 'bg-slate-100 text-slate-800'
              : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'
          )}
          title="Alertas y notificaciones"
        >
          <Bell className="h-5 w-5" />
          {alertCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-black text-white shadow-xs">
              {alertCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {notificationsOpen && (
          <div className="absolute right-0 top-12 z-50 w-80 sm:w-96 rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in fade-in slide-in-from-top-2 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-100 bg-slate-50/50">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">Alertas del Sistema</span>
                {alertCount > 0 && (
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-700">
                    {alertCount} pendientes
                  </span>
                )}
              </div>
              <button
                onClick={() => setNotificationsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="py-1 max-h-80 overflow-y-auto divide-y divide-slate-50">
              {alerts.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 font-bold">
                    ✓
                  </div>
                  <p className="text-sm font-bold text-slate-800">Todo al día</p>
                  <p className="text-xs text-slate-400 mt-0.5">Sin alertas críticas pendientes</p>
                </div>
              ) : (
                alerts.map((alert) => (
                  <button
                    key={alert.id}
                    onClick={() => goAlert(alert.path)}
                    className="flex w-full items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left group"
                  >
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${alert.bg}`}
                    >
                      {alert.icon}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {alert.title}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                        {alert.desc}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-300 mt-1.5 shrink-0 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* User Avatar with Luxury Role Badge */}
      {user && (
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200/80">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-xs font-black text-white shadow-xs ring-2 ring-white">
            {getInitials(user?.name)}
          </div>
          <div className="hidden md:flex flex-col items-start leading-none">
            <span className="text-xs font-bold text-slate-800 truncate max-w-[120px]">
              {user?.name ? user.name.split(' ')[0] : 'Usuario'}
            </span>
            <span
              className={cn(
                'mt-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.2 text-[9px] font-bold border',
                roleMeta.bg,
                roleMeta.text,
                roleMeta.border
              )}
            >
              <span className={cn('h-1 w-1 rounded-full', roleMeta.dot)} />
              {roleMeta.label}
            </span>
          </div>
        </div>
      )}
    </header>
  )
}
