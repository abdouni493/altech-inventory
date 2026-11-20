import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react'
import { Layout } from '@/components/layout/Layout'
import { BrandMark } from '@/components/layout/BrandMark'
import { useAuthStore } from '@/store/useAuthStore'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { StockPage } from '@/pages/Stock/StockPage'
import { PurchasePage } from '@/pages/Purchase/PurchasePage'
import { DepartmentsPage } from '@/pages/Departments/DepartmentsPage'
import { AffectationsPage } from '@/pages/Affectations/AffectationsPage'
import { SuppliersPage } from '@/pages/Suppliers/SuppliersPage'
import { WorkersPage } from '@/pages/Workers/WorkersPage'
import { ExpensesPage } from '@/pages/Expenses/ExpensesPage'
import { BudgetPage } from '@/pages/Budget/BudgetPage'
import { ReportsPage } from '@/pages/Reports/ReportsPage'
import { SettingsPage } from '@/pages/Settings/SettingsPage'
import { ScanPage } from '@/pages/Scan/ScanPage'
import { useTranslation } from '@/i18n/useTranslation'

const RequireAuth = () => {
  const currentUser = useAuthStore((s) => s.currentUser)
  return currentUser ? <Outlet /> : <Navigate to="/login" replace />
}

/** Splash shown while the local database is opened. */
const Splash = () => {
  const { t } = useTranslation()
  return (
    <div className="wood-grain flex min-h-screen flex-col items-center justify-center gap-5 bg-wood-sidebar">
      <BrandMark size={84} className="animate-bloom" />
      <div className="text-center">
        <p className="text-display text-2xl font-bold text-white">Altech Inventory</p>
        <p className="mt-2 flex items-center justify-center gap-2 text-sm font-medium text-white/70">
          <Loader2 size={15} className="animate-spin" />
          {t('openingDatabase')}
        </p>
      </div>
    </div>
  )
}

/** The database could not be opened — most often the local server is stopped. */
const BootError = ({ message }: { message: string }) => {
  const { t } = useTranslation()
  return (
    <div className="wood-grain flex min-h-screen items-center justify-center bg-wood-sidebar p-4">
      <div className="glass relative z-10 w-full max-w-md rounded-2xl p-7 text-center text-white">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-terracotta/20 text-terracotta">
          <TriangleAlert size={28} />
        </div>
        <h1 className="text-display text-xl font-bold">{t('databaseUnavailable')}</h1>
        <p className="mt-2 text-sm text-white/70">{t('databaseUnavailableHint')}</p>
        <p className="mt-3 rounded-lg bg-black/25 px-3 py-2 font-mono text-xs text-white/60">{message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-wood-dark transition hover:bg-wood-cream"
        >
          <RefreshCw size={16} />
          {t('retry')}
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const init = useAuthStore((s) => s.init)
  const ready = useAuthStore((s) => s.ready)
  const bootError = useAuthStore((s) => s.bootError)

  useEffect(() => {
    init()
  }, [init])

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2600,
          style: {
            background: '#0B1324',
            color: '#F4F6FB',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '12px',
            boxShadow: '0 16px 32px -12px rgba(11, 19, 36, 0.45)',
            fontWeight: 500,
            fontSize: '14px',
          },
          success: { iconTheme: { primary: '#12B76A', secondary: '#0B1324' } },
          error: { iconTheme: { primary: '#F04438', secondary: '#0B1324' } },
        }}
      />
      <Routes>
        {/* Phone barcode scanner — no login, paired by the QR code shown on the affectation screen */}
        <Route path="/scan/:sessionId" element={<ScanPage />} />

        {!ready ? (
          <Route path="*" element={<Splash />} />
        ) : bootError ? (
          <Route path="*" element={<BootError message={bootError} />} />
        ) : (
          <>
            <Route path="/login" element={<Login />} />
            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/stock" element={<StockPage />} />
                <Route path="/purchase" element={<PurchasePage />} />
                <Route path="/affectations" element={<AffectationsPage />} />
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/workers" element={<WorkersPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/budget" element={<BudgetPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
