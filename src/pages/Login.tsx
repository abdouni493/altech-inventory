import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Globe,
  UserPlus,
  LogIn,
  Loader2,
  ShieldCheck,
  HardDrive,
  Eye,
  EyeOff,
  ClipboardList,
  Boxes,
  WifiOff,
  ArrowLeft,
  PlayCircle,
  Sparkles,
} from 'lucide-react'
import { useAuthStore, authErrorMessage } from '@/store/useAuthStore'
import { useTranslation } from '@/i18n/useTranslation'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { BrandMark } from '@/components/layout/BrandMark'
import { DEMO_EMAIL, DEMO_PASSWORD } from '@/data/demoData'
import { useDepartmentStore } from '@/store/useDepartmentStore'
import { loadDemoData } from '@/utils/export'

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})
type LoginForm = z.infer<typeof loginSchema>

const Feature = ({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) => (
  <div className="flex items-start gap-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold-light ring-1 ring-white/15">
      {icon}
    </div>
    <div>
      <p className="text-sm font-bold text-white">{title}</p>
      <p className="text-xs leading-relaxed text-white/60">{text}</p>
    </div>
  </div>
)

export const Login = () => {
  const { t, toggleLang, lang } = useTranslation()
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const createAdmin = useAuthStore((s) => s.createAdmin)
  const loginDemo = useAuthStore((s) => s.loginDemo)
  // Reactive: the moment an admin exists, the creation button is gone for good.
  const hasAdmin = useAuthStore((s) => s.users.some((u) => u.role === 'admin'))

  const [mode, setMode] = useState<'login' | 'create'>('login')
  const [submitting, setSubmitting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)

  const onDemo = async () => {
    setDemoLoading(true)
    try {
      // First demo login on a database without the inventory data: load the test set.
      if (useDepartmentStore.getState().departments.length === 0) await loadDemoData()
      const user = await loginDemo()
      toast.success(`${t('welcomeBack')}, ${user.fullName}`)
      navigate('/dashboard')
    } catch (e) {
      toast.error(authErrorMessage(e))
    } finally {
      setDemoLoading(false)
    }
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) })

  const onLogin = async (data: LoginForm) => {
    setSubmitting(true)
    try {
      const user = await login(data.identifier, data.password)
      if (user) {
        toast.success(`${t('welcomeBack')}, ${user.fullName}`)
        navigate('/dashboard')
      } else {
        toast.error(t('wrongCredentials'))
      }
    } catch (e) {
      toast.error(authErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  const createSchema = z
    .object({
      fullName: z.string().min(2),
      username: z.string().min(2),
      email: z.string().email(),
      password: z.string().min(4),
      confirm: z.string().min(4),
    })
    .refine((d) => d.password === d.confirm, { path: ['confirm'], message: t('passwordMismatch') })
  type CreateForm = z.infer<typeof createSchema>

  const createForm = useForm<CreateForm>({ resolver: zodResolver(createSchema) })

  const onCreate = async (data: CreateForm) => {
    setCreating(true)
    try {
      const user = await createAdmin({
        fullName: data.fullName,
        username: data.username,
        email: data.email,
        password: data.password,
      })
      toast.success(`${t('accountCreated')} — ${user.fullName}`)
      navigate('/dashboard')
    } catch (e) {
      toast.error(authErrorMessage(e))
    } finally {
      setCreating(false)
    }
  }

  const showCreate = mode === 'create' && !hasAdmin
  const fieldClass =
    'w-full rounded-lg border border-[#D5DBE8] bg-white px-3.5 py-2.5 text-sm text-charcoal outline-none transition placeholder:text-wood-medium/50 focus:border-wood-warm focus:ring-4 focus:ring-wood-warm/15'

  return (
    <div className="flex min-h-screen bg-[#F4F6FB]">
      {/* Brand panel — desktop */}
      <div className="wood-grain relative hidden w-[46%] max-w-[640px] flex-col justify-between overflow-hidden bg-wood-sidebar p-10 lg:flex">
        <div className="relative z-10 flex items-center gap-3">
          <BrandMark size={48} />
          <div>
            <p className="text-display text-xl font-bold text-white">{t('appName')}</p>
            <p className="text-xs font-medium text-white/55">{t('appTagline')}</p>
          </div>
        </div>

        <div className="relative z-10">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-display max-w-md text-4xl font-bold leading-tight text-white"
          >
            {t('loginHeadline')}
          </motion.h1>
          <div className="mt-8 space-y-5">
            <Feature icon={<ClipboardList size={20} />} title={t('featurePos')} text={t('featurePosText')} />
            <Feature icon={<Boxes size={20} />} title={t('featureRetail')} text={t('featureRetailText')} />
            <Feature icon={<WifiOff size={20} />} title={t('featureOffline')} text={t('featureOfflineText')} />
          </div>
        </div>

        {/* scanner beam decoration */}
        <div className="pointer-events-none absolute -end-24 bottom-24 h-64 w-64 rounded-full bg-aqua/20 blur-3xl" />
        <p className="relative z-10 text-xs text-white/40">© {new Date().getFullYear()} Altech Inventory · {t('demoVersion')}</p>
      </div>

      {/* Form side */}
      <div className="relative flex flex-1 items-center justify-center p-4 sm:p-8">
        <div className="absolute end-4 top-4 flex items-center gap-2 sm:end-6 sm:top-6">
          <span className="hidden items-center gap-1.5 rounded-lg border border-sage/30 bg-sage/10 px-2.5 py-1.5 text-xs font-semibold text-[#067647] sm:flex">
            <HardDrive size={13} />
            {t('offlineMode')}
          </span>
          <button
            onClick={toggleLang}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-woodborder bg-white px-3 text-xs font-bold text-wood-medium shadow-wood transition hover:text-wood-warm"
          >
            <Globe size={15} />
            {lang === 'fr' ? 'العربية' : 'Français'}
          </button>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="w-full max-w-[420px]"
        >
          <div className="mb-7 flex flex-col items-center text-center lg:hidden">
            <BrandMark size={64} />
            <p className="text-display mt-3 text-2xl font-bold text-wood-dark">{t('appName')}</p>
          </div>

          <AnimatePresence mode="wait">
            {!showCreate ? (
              <motion.div
                key="login"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                <h2 className="text-display text-2xl font-bold text-wood-dark">{t('login')}</h2>
                <p className="mb-5 mt-1 text-sm text-wood-medium">{t('loginSubtitle')}</p>

                {/* Demo version: one click to explore with test data */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="mb-5 overflow-hidden rounded-2xl border border-wood-warm/25 bg-gradient-to-br from-wood-warm/10 via-white to-aqua/10 p-4"
                >
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-wood-warm">
                    <Sparkles size={14} />
                    {t('demoVersion')}
                  </p>
                  <p className="mb-3 mt-1 text-xs text-wood-medium">{t('demoHint')}</p>
                  <Button type="button" size="lg" variant="gold" className="w-full" onClick={onDemo} disabled={demoLoading}>
                    {demoLoading ? <Loader2 size={18} className="animate-spin" /> : <PlayCircle size={18} />}
                    {t('demoLogin')}
                  </Button>
                  <p className="text-mono mt-2 text-center text-[11px] text-wood-medium">
                    {t('demoCredentials')} : {DEMO_EMAIL} / {DEMO_PASSWORD}
                  </p>
                </motion.div>

                <form onSubmit={handleSubmit(onLogin)} className="space-y-4">
                  <div>
                    <label className="label-wood">
                      {t('email')} / {t('username')}
                    </label>
                    <input {...register('identifier')} autoFocus autoComplete="username" placeholder="demo@altech.dz" className={fieldClass} />
                    {errors.identifier && <p className="mt-1 text-xs text-terracotta">{t('required')}</p>}
                  </div>
                  <div>
                    <label className="label-wood">{t('password')}</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password')}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        className={`${fieldClass} pe-11`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute end-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-wood-medium hover:bg-wood-cream"
                        aria-label={t('view')}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.password && <p className="mt-1 text-xs text-terracotta">{t('required')}</p>}
                  </div>

                  <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                    {submitting ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
                    {t('login')}
                  </Button>
                </form>

                {/* First run only: create the administrator */}
                {!hasAdmin ? (
                  <div className="mt-6 rounded-xl border border-gold/40 bg-gold/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-[#B45309]">{t('firstRun')}</p>
                    <p className="mb-3 mt-1 text-xs text-wood-medium">{t('createAdminHint')}</p>
                    <Button type="button" variant="gold" className="w-full" onClick={() => setMode('create')}>
                      <UserPlus size={17} />
                      {t('createAdmin')}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-6 flex items-center justify-center gap-1.5 text-center text-xs text-wood-medium">
                    <ShieldCheck size={14} className="text-sage" />
                    {t('adminAlreadyCreated')}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.form
                key="create"
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
                onSubmit={createForm.handleSubmit(onCreate)}
                className="space-y-3.5"
              >
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="mb-1 inline-flex items-center gap-1.5 text-sm font-semibold text-wood-medium hover:text-wood-warm"
                >
                  <ArrowLeft size={16} className="rtl:rotate-180" />
                  {t('login')}
                </button>
                <h2 className="text-display text-2xl font-bold text-wood-dark">{t('createAdmin')}</h2>
                <p className="!mt-1 text-sm text-wood-medium">{t('createAdminHint')}</p>
                <Input label={t('fullName')} autoFocus {...createForm.register('fullName')} error={createForm.formState.errors.fullName && t('required')} />
                <Input label={t('username')} {...createForm.register('username')} error={createForm.formState.errors.username && t('required')} />
                <Input label={t('email')} type="email" {...createForm.register('email')} error={createForm.formState.errors.email && t('required')} />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <Input label={t('password')} type="password" {...createForm.register('password')} error={createForm.formState.errors.password && t('passwordMin')} />
                  <Input label={t('confirmPassword')} type="password" {...createForm.register('confirm')} error={createForm.formState.errors.confirm?.message} />
                </div>
                <Button type="submit" variant="sage" size="lg" className="w-full" disabled={creating}>
                  {creating ? <Loader2 size={18} className="animate-spin" /> : <UserPlus size={18} />}
                  {t('createMyAdmin')}
                </Button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}
