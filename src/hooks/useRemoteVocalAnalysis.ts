import { useCallback, useEffect, useState } from 'react'
import type { AnalysisState, VocalAnalysis } from './useBrowserVocalAnalysis'

const EMPTY: AnalysisState = {
  status: 'idle', progress: 0, data: null, error: null,
}

export function useRemoteVocalAnalysis(file: File | null, apiUrl: string) {
  const [state, setState] = useState<AnalysisState>(EMPTY)
  const [cancelledFile, setCancelledFile] = useState<File | null>(null)

  const cancel = useCallback(() => {
    setCancelledFile(file)
    setState(EMPTY)
  }, [file])

  useEffect(() => {
    if (!apiUrl || !file || file === cancelledFile) {
      setState(EMPTY)
      return
    }
    const controller = new AbortController()
    const run = async () => {
      setState({ status: 'processing', progress: 0, data: null, error: null })
      try {
        if (file.size > 25 * 1024 * 1024) {
          throw new Error('Remote analysis supports files up to 25 MB')
        }
        const form = new FormData()
        form.append('file', file, file.name)
        const response = await fetch(`${apiUrl}/analyze`, {
          method: 'POST', body: form, signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error(`Analysis service returned HTTP ${response.status}`)
        }
        const result: unknown = await response.json()
        if (controller.signal.aborted) return
        if (!result || typeof result !== 'object') throw new Error('Invalid analysis response')
        const value = result as Record<string, unknown>
        const fps = Number(value.framesPerSecond)
        const fields = ['levels', 'pitches', 'musicLevels'] as const
        if (fps !== 50 || fields.some(key => !Array.isArray(value[key]))) {
          throw new Error('Unsupported analysis response')
        }
        const arrays = fields.map(key => {
          const items = value[key] as unknown[]
          if (items.length === 0 || items.length > 100000) throw new Error('Invalid timeline length')
          const values = new Float32Array(items.length)
          for (let i = 0; i < items.length; i++) {
            const n = items[i]
            if (typeof n !== 'number' || !Number.isFinite(n)) throw new Error('Invalid timeline data')
            values[i] = n
          }
          return values
        })
        if (arrays.some(a => a.length !== arrays[0].length)) throw new Error('Mismatched timelines')
        const data: VocalAnalysis = {
          framesPerSecond: fps,
          levels: arrays[0], pitches: arrays[1], musicLevels: arrays[2],
        }
        setState({ status: 'ready', progress: 100, data, error: null })
      } catch (error) {
        if (controller.signal.aborted) return
        setState({ status: 'error', progress: 0, data: null,
          error: error instanceof Error ? error.message : 'Remote analysis failed' })
      }
    }
    void run()
    return () => controller.abort()
  }, [apiUrl, file, cancelledFile])

  return { ...state, cancel }
}
