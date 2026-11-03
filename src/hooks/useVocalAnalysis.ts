import { useCallback, useEffect, useState } from 'react'
import { useBrowserVocalAnalysis } from './useBrowserVocalAnalysis'
import { useRemoteVocalAnalysis } from './useRemoteVocalAnalysis'
export type { VocalAnalysis, AnalysisState, AnalysisStatus } from './useBrowserVocalAnalysis'

// SONG_PAINTER_HYBRID_BACKEND_V7
// Set VITE_ANALYSIS_API_URL to the Modal endpoint's origin; empty = local-only.
const API_URL = (import.meta.env.VITE_ANALYSIS_API_URL || '').trim().replace(/\/+$/, '')

export function useVocalAnalysis(file: File | null) {
  const [fallbackFile, setFallbackFile] = useState<File | null>(null)
  const [cancelledFile, setCancelledFile] = useState<File | null>(null)
  const remote = useRemoteVocalAnalysis(API_URL && file !== fallbackFile && file !== cancelledFile ? file : null, API_URL)
  const useLocal = !API_URL || file === fallbackFile
  const local = useBrowserVocalAnalysis(useLocal && file !== cancelledFile ? file : null)

  useEffect(() => {
    if (file && API_URL && remote.status === 'error' && file !== cancelledFile) {
      setFallbackFile(file)
    }
  }, [file, remote.status, cancelledFile])

  const cancel = useCallback(() => {
    remote.cancel()
    local.cancel()
    setCancelledFile(file)
    setFallbackFile(null)
  }, [remote.cancel, local.cancel, file])

  if (file === cancelledFile) {
    return { status: 'idle' as const, progress: 0, data: null, error: null, cancel }
  }
  return { ...(useLocal ? local : remote), cancel }
}
