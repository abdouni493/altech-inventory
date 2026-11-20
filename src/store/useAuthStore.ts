import { create } from 'zustand'
import type { AppUser, LocalUser, Worker } from '@/types'
import { hashPassword, newSalt, verifyPassword } from '@/lib/password'
import { uid } from '@/utils/helpers'
import { useWorkerStore } from './useWorkerStore'
import { flushDatabase, initDatabase } from '@/lib/database'

const SESSION_KEY = 'altech-inventory-session'

const readSession = (): string | null => {
  try {
    return localStorage.getItem(SESSION_KEY)
  } catch {
    return null
  }
}
const writeSession = (userId: string | null) => {
  try {
    if (userId) localStorage.setItem(SESSION_KEY, userId)
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    /* private mode — the session simply won't survive a reload */
  }
}

const norm = (v: string) => v.trim().toLowerCase()

/**
 * What the screens see of a login. Employee permissions are read live from
 * their worker record, so editing them in "Employés" applies on next render.
 */
const toAppUser = (u: LocalUser, workers: Worker[]): AppUser | null => {
  if (u.role === 'admin') {
    return {
      id: u.id,
      fullName: u.fullName,
      username: u.username,
      email: u.email,
      password: '',
      role: 'Administrateur',
      permissions: 'ALL',
    }
  }
  const worker = workers.find((w) => w.id === u.workerId)
  if (!worker || !worker.active || !worker.hasAccount) return null
  return {
    id: u.id,
    fullName: worker.fullName || u.fullName,
    username: u.username,
    email: u.email,
    password: '',
    role: worker.role || 'Employé',
    permissions: worker.permissions ?? {},
  }
}

interface AuthState {
  /** Every login of the shop — persisted in the local database. */
  users: LocalUser[]
  currentUser: AppUser | null
  /** false until the local database is loaded. */
  ready: boolean
  /** Set when the database could not be opened at boot. */
  bootError: string

  init: () => Promise<void>
  login: (identifier: string, password: string) => Promise<AppUser | null>
  /** Demo version: signs in with the demonstration account (created if missing). */
  loginDemo: () => Promise<AppUser>
  createAdmin: (data: { fullName: string; username: string; email: string; password: string }) => Promise<AppUser>
  hasAdmin: () => boolean
  logout: () => void
  updateAccount: (data: Partial<Pick<AppUser, 'fullName' | 'username' | 'email' | 'password'>>) => Promise<void>
  /** Creates or refreshes the login of an employee. */
  upsertWorkerAccount: (worker: Worker, password?: string) => void
  removeWorkerAccount: (workerId: string) => void
}

/** Is this email / username already used by another login? */
const identifierTaken = (users: LocalUser[], value: string, exceptId?: string) => {
  const v = norm(value)
  if (!v) return false
  return users.some((u) => u.id !== exceptId && (norm(u.email) === v || norm(u.username) === v))
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  users: [],
  currentUser: null,
  ready: false,
  bootError: '',

  init: async () => {
    try {
      await initDatabase()
      const sessionId = readSession()
      const user = sessionId ? get().users.find((u) => u.id === sessionId) : undefined
      const appUser = user ? toAppUser(user, useWorkerStore.getState().workers) : null
      if (!appUser) writeSession(null)
      set({ currentUser: appUser, bootError: '' })

      // Permission / name edits of the signed-in employee apply right away;
      // a disabled employee is signed out.
      useWorkerStore.subscribe((s, prev) => {
        if (s.workers === prev.workers) return
        const current = get().currentUser
        const login = current && get().users.find((u) => u.id === current.id)
        if (!login || login.role !== 'worker') return
        const next = toAppUser(login, s.workers)
        if (!next) get().logout()
        else set({ currentUser: next })
      })
    } catch (e) {
      console.error('[auth] database', e)
      set({ bootError: (e as Error).message || 'DATABASE_ERROR' })
    } finally {
      set({ ready: true })
    }
  },

  // Email OR username, case-insensitive.
  login: async (identifier, password) => {
    const id = norm(identifier)
    const user = get().users.find((u) => norm(u.email) === id || (u.username && norm(u.username) === id))
    if (!user || !verifyPassword(password, user.salt, user.passwordHash)) return null
    const appUser = toAppUser(user, useWorkerStore.getState().workers)
    if (!appUser) return null
    writeSession(user.id)
    set({ currentUser: appUser })
    return appUser
  },

  loginDemo: async () => {
    const { demoAdminUser, DEMO_USER_ID } = await import('@/data/demoData')
    let user = get().users.find((u) => u.id === DEMO_USER_ID)
    if (!user) {
      user = demoAdminUser()
      const demo = user
      set((s) => ({ users: [...s.users, demo] }))
      await flushDatabase()
    }
    const appUser = { ...toAppUser(user, [])!, isDemo: true }
    writeSession(user.id)
    set({ currentUser: appUser })
    return appUser
  },

  // Login page → "Créer un compte Admin" — only while no admin exists.
  createAdmin: async ({ fullName, username, email, password }) => {
    if (get().hasAdmin()) throw new Error('ADMIN_ALREADY_EXISTS')
    if (password.length < 4) throw new Error('PASSWORD_TOO_SHORT')
    const salt = newSalt()
    const admin: LocalUser = {
      id: uid('u'),
      role: 'admin',
      fullName: fullName.trim(),
      username: username.trim(),
      email: email.trim().toLowerCase(),
      salt,
      passwordHash: hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    }
    set((s) => ({ users: [admin, ...s.users] }))
    await flushDatabase()
    const appUser = toAppUser(admin, [])!
    writeSession(admin.id)
    set({ currentUser: appUser })
    return appUser
  },

  hasAdmin: () => get().users.some((u) => u.role === 'admin'),

  logout: () => {
    writeSession(null)
    set({ currentUser: null })
  },

  updateAccount: async (data) => {
    const current = get().currentUser
    if (!current) return
    const login = get().users.find((u) => u.id === current.id)
    if (!login) return
    if (data.email && identifierTaken(get().users, data.email, login.id)) throw new Error('EMAIL_TAKEN')
    if (data.username && identifierTaken(get().users, data.username, login.id)) throw new Error('USERNAME_TAKEN')
    if (data.password && data.password.length < 4) throw new Error('PASSWORD_TOO_SHORT')

    const salt = data.password ? newSalt() : login.salt
    const updated: LocalUser = {
      ...login,
      fullName: data.fullName?.trim() || login.fullName,
      username: data.username?.trim() ?? login.username,
      email: data.email?.trim().toLowerCase() || login.email,
      salt,
      passwordHash: data.password ? hashPassword(data.password, salt) : login.passwordHash,
    }
    set((s) => ({ users: s.users.map((u) => (u.id === login.id ? updated : u)) }))
    const next = toAppUser(updated, useWorkerStore.getState().workers)
    if (next) set({ currentUser: next })
  },

  upsertWorkerAccount: (worker, password) => {
    const existing = get().users.find((u) => u.workerId === worker.id)
    if (identifierTaken(get().users, worker.email, existing?.id)) throw new Error('EMAIL_TAKEN')
    if (worker.username && identifierTaken(get().users, worker.username, existing?.id))
      throw new Error('USERNAME_TAKEN')
    if (!existing && (!password || password.length < 4)) throw new Error('PASSWORD_TOO_SHORT')

    const salt = password ? newSalt() : existing!.salt
    const login: LocalUser = {
      id: existing?.id ?? uid('u'),
      role: 'worker',
      workerId: worker.id,
      fullName: worker.fullName,
      username: worker.username?.trim() ?? '',
      email: worker.email.trim().toLowerCase(),
      salt,
      passwordHash: password ? hashPassword(password, salt) : existing!.passwordHash,
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    }
    set((s) => ({
      users: existing ? s.users.map((u) => (u.id === existing.id ? login : u)) : [...s.users, login],
    }))
  },

  removeWorkerAccount: (workerId) => {
    const login = get().users.find((u) => u.workerId === workerId)
    if (!login) return
    set((s) => ({ users: s.users.filter((u) => u.id !== login.id) }))
    if (get().currentUser?.id === login.id) get().logout()
  },
}))

/** Readable message for the errors thrown above. */
export const authErrorMessage = (error: unknown): string => {
  const raw = (error as { message?: string } | null)?.message ?? String(error ?? '')
  if (/ADMIN_ALREADY_EXISTS/.test(raw)) return 'Un compte administrateur existe déjà'
  if (/PASSWORD_TOO_SHORT/.test(raw)) return 'Mot de passe trop court (4 caractères minimum)'
  if (/EMAIL_TAKEN/.test(raw)) return 'Cet email est déjà utilisé par un autre compte'
  if (/USERNAME_TAKEN/.test(raw)) return "Ce nom d'utilisateur est déjà utilisé"
  if (/WORKER_NOT_FOUND/.test(raw)) return 'Employé introuvable'
  if (/INVALID_BACKUP/.test(raw)) return 'Fichier de sauvegarde invalide'
  if (/Failed to fetch|NetworkError|HTTP 5/i.test(raw)) return 'Serveur local injoignable — relancez Altech Inventory'
  return raw || 'Erreur inconnue'
}
