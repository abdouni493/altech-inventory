import { useCallback, useEffect, useRef, useState } from 'react'
import {
  closeScanSession,
  openScanSession,
  scanUrlFor,
  subscribeScans,
  type ScanSession,
} from './scanSession'

export type PhoneScanStatus = 'off' | 'starting' | 'waiting' | 'connected' | 'error'

export interface PhoneScanState {
  status: PhoneScanStatus
  session: ScanSession | null
  url: string
  error: string
  /** Number of barcodes received from the phone during this session. */
  count: number
  start: () => Promise<void>
  stop: () => void
}

/**
 * Keeps a phone ⇄ cash-register scanning session alive for as long as the POS
 * screen is open, and forwards every barcode filmed by the phone.
 */
export const usePhoneScan = (onBarcode: (barcode: string) => void): PhoneScanState => {
  const [status, setStatus] = useState<PhoneScanStatus>('off')
  const [session, setSession] = useState<ScanSession | null>(null)
  const [error, setError] = useState('')
  const [count, setCount] = useState(0)

  const unsubRef = useRef<(() => void) | null>(null)
  const sessionRef = useRef<ScanSession | null>(null)
  const onBarcodeRef = useRef(onBarcode)
  onBarcodeRef.current = onBarcode

  const stop = useCallback(() => {
    unsubRef.current?.()
    unsubRef.current = null
    const current = sessionRef.current
    sessionRef.current = null
    if (current) closeScanSession(current.id).catch(() => undefined)
    setSession(null)
    setStatus('off')
    setCount(0)
  }, [])

  const start = useCallback(async () => {
    setStatus('starting')
    setError('')
    try {
      const created = await openScanSession('Affectation')
      sessionRef.current = created
      setSession(created)
      setStatus('waiting')
      unsubRef.current?.()
      unsubRef.current = subscribeScans(created.id, (barcode) => {
        setStatus('connected')
        setCount((c) => c + 1)
        onBarcodeRef.current(barcode)
      })
    } catch (e) {
      setStatus('error')
      setError((e as Error).message === 'Failed to fetch' ? 'Serveur local injoignable' : (e as Error).message)
    }
  }, [])

  // stop the session when the POS screen unmounts
  useEffect(
    () => () => {
      unsubRef.current?.()
      unsubRef.current = null
    },
    [],
  )

  return {
    status,
    session,
    url: session ? scanUrlFor(session.id) : '',
    error,
    count,
    start,
    stop,
  }
}
