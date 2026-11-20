import { useDbStatus } from './database'

/* eslint-disable @typescript-eslint/no-explicit-any */

// ============================================================================
// Phone ⇄ POS scanner, relayed by the local Altech POS server.
//
// The POS opens a session and shows a QR code; the phone opens /scan/<id> on
// this PC through the shop Wi-Fi and posts every barcode it films; the POS
// pulls them back every second. No internet connection is involved.
// ============================================================================

export interface ScanSession {
  id: string
  expiresAt: string
}

export interface ScanSessionInfo {
  valid: boolean
  label?: string
  shop?: string
  expiresAt?: string
}

export interface PushScanResult {
  ok: boolean
  found: boolean
  reason?: string
  product?: { id: string; name: string; quantity: number } | null
}

const SCAN_BASE_KEY = 'altech-scan-base'

const isLocalHost = (host: string) => /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(host)

/**
 * Address the phone must open. A manual override wins; otherwise, when the
 * POS itself runs on `localhost`, the PC's network address reported by the
 * local server is used, since the phone cannot reach "localhost".
 */
export const getScanBaseUrl = (): string => {
  const override = localStorage.getItem(SCAN_BASE_KEY)
  if (override) return override.replace(/\/+$/, '')
  const env = import.meta.env.VITE_SCAN_BASE_URL as string | undefined
  if (env) return env.replace(/\/+$/, '')
  if (isLocalHost(window.location.hostname)) {
    const lan = useDbStatus.getState().lanUrls[0]
    if (lan) return lan
  }
  return window.location.origin
}

export const setScanBaseUrl = (url: string): void => {
  const clean = url.trim().replace(/\/+$/, '')
  if (clean) localStorage.setItem(SCAN_BASE_KEY, clean)
  else localStorage.removeItem(SCAN_BASE_KEY)
}

export const isLocalOnlyOrigin = (): boolean => isLocalHost(new URL(getScanBaseUrl()).hostname)

export const scanUrlFor = (sessionId: string): string => `${getScanBaseUrl()}/scan/${sessionId}`

const call = async (url: string, init?: RequestInit): Promise<any> => {
  const res = await fetch(url, {
    cache: 'no-store',
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

// ----------------------------------------------------------------------------
// Cash register side
// ----------------------------------------------------------------------------

/** POS → "Scanner avec mon téléphone": opens the pairing session. */
export const openScanSession = async (label = 'POS'): Promise<ScanSession> => {
  const data = await call('/api/scan/sessions', { method: 'POST', body: JSON.stringify({ label }) })
  return { id: data.id, expiresAt: data.expiresAt }
}

export const closeScanSession = async (sessionId: string): Promise<void> => {
  await call(`/api/scan/sessions/${sessionId}`, { method: 'DELETE' })
}

/** Streams every barcode filmed by the paired phone. Each event is delivered once. */
export const subscribeScans = (
  sessionId: string,
  onBarcode: (barcode: string, eventId: number) => void,
): (() => void) => {
  let lastId = 0
  let stopped = false

  const poll = async () => {
    if (stopped) return
    try {
      const events = await call(`/api/scan/sessions/${sessionId}/scans?after=${lastId}`)
      if (Array.isArray(events))
        events.forEach((e: any) => {
          const id = Number(e.id)
          if (stopped || id <= lastId) return
          lastId = id
          onBarcode(String(e.barcode), id)
        })
    } catch {
      /* server busy — retry on the next tick */
    }
  }

  void poll()
  const timer = window.setInterval(poll, 1000)
  return () => {
    stopped = true
    window.clearInterval(timer)
  }
}

// ----------------------------------------------------------------------------
// Phone side (no account needed)
// ----------------------------------------------------------------------------

export const fetchScanSessionInfo = (sessionId: string): Promise<ScanSessionInfo> =>
  call(`/api/scan/sessions/${sessionId}`)

export const pushScan = async (sessionId: string, barcode: string): Promise<PushScanResult> => {
  const d = await call(`/api/scan/sessions/${sessionId}/scans`, {
    method: 'POST',
    body: JSON.stringify({ barcode }),
  })
  return { ok: !!d?.ok, found: !!d?.found, reason: d?.reason, product: d?.product ?? null }
}
