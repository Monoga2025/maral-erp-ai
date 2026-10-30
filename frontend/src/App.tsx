import { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/auth'
import AppLayout from './components/layout/AppLayout'
import MobileLayout from './components/layout/MobileLayout'
import { TourProvider } from './components/tour/TourProvider'
import { ErrorBoundary } from './components/ErrorBoundary'
import { RequireRole } from './components/auth/RequireRole'
import { useMobile } from './hooks/useMobile'
import { PageSkeleton } from './components/ui/LoadingSkeleton'

// Lazy loaded page components for optimal code splitting
const Login = lazy(() => import('./pages/Login'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Clients = lazy(() => import('./pages/Clients'))
const ClientDetail = lazy(() => import('./pages/ClientDetail'))
const ClientForm = lazy(() => import('./pages/ClientForm'))
const Quotations = lazy(() => import('./pages/Quotations'))
const QuotationForm = lazy(() => import('./pages/QuotationForm'))
const Orders = lazy(() => import('./pages/Orders'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const OrderForm = lazy(() => import('./pages/OrderForm'))
const Inventory = lazy(() => import('./pages/Inventory'))
const Production = lazy(() => import('./pages/Production'))
const Purchases = lazy(() => import('./pages/Purchases'))
const Credit = lazy(() => import('./pages/Credit'))
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'))
const Catalog = lazy(() => import('./pages/Catalog'))
const ProductForm = lazy(() => import('./pages/ProductForm'))
const Reports = lazy(() => import('./pages/Reports'))
const Settings = lazy(() => import('./pages/Settings'))
const Manual = lazy(() => import('./pages/Manual'))
const Tareas = lazy(() => import('./pages/Tareas'))
const Gastos = lazy(() => import('./pages/Gastos'))
const Whatsapp = lazy(() => import('./pages/Whatsapp'))
const Campaigns = lazy(() => import('./pages/Campaigns'))
const CampaignComposer = lazy(() => import('./components/campaigns/CampaignComposer'))
const CampaignWizard = lazy(() => import('./pages/CampaignWizard'))
const CampaignLiveView = lazy(() => import('./components/campaigns/CampaignLiveView'))
const ImageLibrary = lazy(() => import('./pages/ImageLibrary'))
const CampaignLeads = lazy(() => import('./pages/CampaignLeads'))
const CampaignReports = lazy(() => import('./pages/CampaignReports'))
const Tags = lazy(() => import('./pages/Tags'))

// Mobile lazy loaded views
const MobileDashboard = lazy(() => import('./pages/mobile/MobileDashboard'))
const MobileOrders = lazy(() => import('./pages/mobile/MobileOrders'))
const MobileClients = lazy(() => import('./pages/mobile/MobileClients'))
const MobileQuotations = lazy(() => import('./pages/mobile/MobileQuotations'))
const MobileGastos = lazy(() => import('./pages/mobile/MobileGastos'))
const MobileTareas = lazy(() => import('./pages/mobile/MobileTareas'))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="p-6 max-w-7xl mx-auto animate-fade-in">
          <PageSkeleton />
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const isMobile = useMobile()

  return (
    <ErrorBoundary>
      <TourProvider>
        <SuspenseWrapper>
          <Routes>
            <Route
              path="/login"
              element={isAuthenticated ? <Navigate to="/" replace /> : <Login />}
            />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  {isMobile ? <MobileLayout /> : <AppLayout />}
                </ProtectedRoute>
              }
            >
              {/* Dashboard & Tareas - Disponibles para todos los roles */}
              <Route index element={isMobile ? <MobileDashboard /> : <Dashboard />} />
              <Route path="tareas" element={isMobile ? <MobileTareas /> : <Tareas />} />
              <Route path="manual" element={<Manual />} />

              {/* Pedidos & Despachos - Compartido comercial / taller / facturación */}
              <Route path="pedidos" element={isMobile ? <MobileOrders /> : <Orders />} />
              <Route path="pedidos/nuevo" element={<OrderForm />} />
              <Route path="pedidos/:id" element={<OrderDetail />} />

              {/* Comercial & Clientes - Solo Gerente y Ventas */}
              <Route
                path="clientes"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    {isMobile ? <MobileClients /> : <Clients />}
                  </RequireRole>
                }
              />
              <Route
                path="clientes/nuevo"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <ClientForm />
                  </RequireRole>
                }
              />
              <Route
                path="clientes/:id"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <ClientDetail />
                  </RequireRole>
                }
              />
              <Route
                path="clientes/:id/editar"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <ClientForm />
                  </RequireRole>
                }
              />

              <Route
                path="cotizaciones"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    {isMobile ? <MobileQuotations /> : <Quotations />}
                  </RequireRole>
                }
              />
              <Route
                path="cotizaciones/nueva"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <QuotationForm />
                  </RequireRole>
                }
              />
              <Route
                path="cotizaciones/:id"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <QuotationForm />
                  </RequireRole>
                }
              />
              <Route
                path="cotizaciones/:id/editar"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <QuotationForm />
                  </RequireRole>
                }
              />

              <Route
                path="whatsapp"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <Whatsapp />
                  </RequireRole>
                }
              />
              <Route
                path="campanas"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <Campaigns />
                  </RequireRole>
                }
              />
              <Route
                path="campanas/nueva"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <CampaignWizard />
                  </RequireRole>
                }
              />
              <Route
                path="campanas/:id"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <CampaignLiveView />
                  </RequireRole>
                }
              />
              <Route
                path="campanas/:id/editar"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <CampaignComposer />
                  </RequireRole>
                }
              />
              <Route
                path="whatsapp/biblioteca"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <ImageLibrary />
                  </RequireRole>
                }
              />
              <Route
                path="whatsapp/leads"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <CampaignLeads />
                  </RequireRole>
                }
              />
              <Route
                path="reportes/campanas"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <CampaignReports />
                  </RequireRole>
                }
              />
              <Route
                path="etiquetas"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS']}>
                    <Tags />
                  </RequireRole>
                }
              />

              {/* Taller & Producción - Solo Gerente y Logística */}
              <Route
                path="produccion"
                element={
                  <RequireRole roles={['GERENTE', 'LOGISTICA']}>
                    <Production />
                  </RequireRole>
                }
              />
              <Route
                path="inventario"
                element={
                  <RequireRole roles={['GERENTE', 'LOGISTICA']}>
                    <Inventory />
                  </RequireRole>
                }
              />
              <Route
                path="compras"
                element={
                  <RequireRole roles={['GERENTE', 'LOGISTICA']}>
                    <Purchases />
                  </RequireRole>
                }
              />

              {/* Finanzas & Cartera - Solo Gerente y Contadora */}
              <Route
                path="credito"
                element={
                  <RequireRole roles={['GERENTE', 'CONTADORA']}>
                    <Credit />
                  </RequireRole>
                }
              />
              <Route
                path="facturas/:id"
                element={
                  <RequireRole roles={['GERENTE', 'CONTADORA']}>
                    <InvoiceDetail />
                  </RequireRole>
                }
              />
              <Route
                path="gastos"
                element={
                  <RequireRole roles={['GERENTE', 'CONTADORA']}>
                    {isMobile ? <MobileGastos /> : <Gastos />}
                  </RequireRole>
                }
              />
              <Route
                path="reportes"
                element={
                  <RequireRole roles={['GERENTE', 'CONTADORA']}>
                    <Reports />
                  </RequireRole>
                }
              />

              {/* Catálogo de Productos - Gerente, Ventas y Logística */}
              <Route
                path="catalogo"
                element={
                  <RequireRole roles={['GERENTE', 'VENTAS', 'LOGISTICA']}>
                    <Catalog />
                  </RequireRole>
                }
              />
              <Route
                path="catalogo/nuevo"
                element={
                  <RequireRole roles={['GERENTE', 'LOGISTICA']}>
                    <ProductForm />
                  </RequireRole>
                }
              />
              <Route
                path="catalogo/:id/editar"
                element={
                  <RequireRole roles={['GERENTE', 'LOGISTICA']}>
                    <ProductForm />
                  </RequireRole>
                }
              />

              {/* Configuración Administrativa - Solo Gerente */}
              <Route
                path="configuracion"
                element={
                  <RequireRole roles={['GERENTE']}>
                    <Settings />
                  </RequireRole>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SuspenseWrapper>
      </TourProvider>
    </ErrorBoundary>
  )
}
