import { useCallback, useEffect, useRef, useState } from 'react'

// SONG_PAINTER_FULL_SONG_V6
// Work is sent to a Web Worker in bounded audio chunks. The browser still
// decodes the original file once, so very large files may require significant
// memory. Later chunks become available without resetting the artwork.
export interface VocalAnalysis {
  levels: Float32Array
  framesPerSecond: number
  pitches?: Float32Array
  musicLevels?: Float32Array
}

export type AnalysisStatus = 'idle' | 'loading' | 'processing' | 'ready' | 'error'

export interface AnalysisState {
  status: AnalysisStatus
  progress: number
  data: VocalAnalysis | null
  error: string | null
}

type WorkerMessage =
  | { type: 'progress'; progress: number }
  | {
      type: 'complete'
      levels: Float32Array
      framesPerSecond: number
      pitches?: Float32Array
      musicLevels?: Float32Array
    }
  | { type: 'error'; message: string }

const EMPTY: AnalysisState = {
  status: 'idle',
  progress: 0,
  data: null,
  error: null,
}

const CHUNK_SECONDS = 15
const FPS = 50
const MAX_FILE_BYTES = 100 * 1024 * 1024

export function useBrowserVocalAnalysis(file: File | null) {
  const [state, setState] = useState<AnalysisState>(EMPTY)
  const [cancelledFile, setCancelledFile] = useState<File | null>(null)
  const workerRef = useRef<Worker | null>(null)

  const cancel = useCallback(() => {
    // Changing cancelledFile cleans up the effect and prevents a restart.
    workerRef.current?.terminate()
    workerRef.current = null
    setCancelledFile(file)
    setState(EMPTY)
  }, [file])

  useEffect(() => {
    if (!file || file === cancelledFile) {
      setState(EMPTY)
      return
    }

    let stopped = false
    let worker: Worker | null = null
    let context: AudioContext | null = null
    setState({ status: 'loading', progress: 0, data: null, error: null })

    const run = async () => {
      try {
        if (file.size > MAX_FILE_BYTES) {
          throw new Error('Audio is over 100 MB. Use a smaller compressed audio file to avoid browser memory exhaustion.')
        }

        context = new AudioContext()
        const raw = await file.arrayBuffer()
        if (stopped) return
        const decoded = await context.decodeAudioData(raw)
        if (stopped) return

        const sampleRate = decoded.sampleRate
        const chunkSamples = Math.max(1, Math.floor(CHUNK_SECONDS * sampleRate))
        const totalChunks = Math.ceil(decoded.length / chunkSamples)
        if (!totalChunks) throw new Error('The audio file is empty.')

        const left = decoded.getChannelData(0)
        const right = decoded.numberOfChannels > 1
          ? decoded.getChannelData(1)
          : left

        const frameCount = Math.ceil(decoded.duration * FPS) + 1
        const fullLevels = new Float32Array(frameCount)
        const fullPitches = new Float32Array(frameCount)
        const fullMusic = new Float32Array(frameCount)
        let chunkIndex = 0

        worker = new Worker(
          new URL('../workers/vocalSeparation.worker.ts', import.meta.url),
          { type: 'module' },
        )
        workerRef.current = worker

        const stopWorker = () => {
          worker?.terminate()
          if (workerRef.current === worker) workerRef.current = null
        }

        const nextChunk = () => {
          if (stopped || !worker) return
          if (chunkIndex >= totalChunks) {
            stopWorker()
            setState(previous => ({
              ...previous,
              status: 'ready',
              progress: 100,
              error: null,
            }))
            return
          }

          const from = chunkIndex * chunkSamples
          const to = Math.min(decoded.length, from + chunkSamples)
          const a = left.slice(from, to)
          const b = right.slice(from, to)
          worker.postMessage(
            { type: 'start', left: a, right: b, sampleRate },
            [a.buffer as ArrayBuffer, b.buffer as ArrayBuffer],
          )
        }

        worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
          if (stopped) return
          const message = event.data

          if (message.type === 'error') {
            stopWorker()
            setState(previous => ({
              ...previous,
              status: 'error',
              error: `Chunk ${chunkIndex + 1}/${totalChunks}: ${message.message}`,
            }))
            return
          }

          if (message.type === 'progress') {
            const fraction = Math.min(1, Math.max(0, message.progress / 100))
            const overall = Math.floor(((chunkIndex + fraction) / totalChunks) * 100)
            setState(previous => ({ ...previous, status: 'processing', progress: Math.min(99, overall) }))
            return
          }

          // Append chunk results at their actual position in the song.
          // Keep the rest zeroed so unprocessed sections never paint falsely.
          const frameOffset = Math.round((chunkIndex * chunkSamples / sampleRate) * FPS)
          const remaining = Math.max(0, frameCount - frameOffset)
          const copy = (source: Float32Array | undefined, target: Float32Array) => {
            if (!source || !remaining) return
            target.set(source.subarray(0, remaining), frameOffset)
          }
          copy(message.levels, fullLevels)
          copy(message.pitches, fullPitches)
          copy(message.musicLevels, fullMusic)

          chunkIndex += 1
          const snapshot: VocalAnalysis = {
            // New snapshots let React publish partial results while keeping the
            // arrays held by the current canvas render immutable.
            levels: fullLevels.slice(),
            framesPerSecond: FPS,
            pitches: fullPitches.slice(),
            musicLevels: fullMusic.slice(),
          }
          setState({
            status: chunkIndex === totalChunks ? 'ready' : 'processing',
            progress: Math.floor((chunkIndex / totalChunks) * 100),
            data: snapshot,
            error: null,
          })
          nextChunk()
        }

        worker.onerror = (event: ErrorEvent) => {
          if (stopped) return
          stopWorker()
          setState(previous => ({
            ...previous,
            status: 'error',
            error: event.message || 'Background vocal processing failed.',
          }))
        }

        setState({ status: 'processing', progress: 0, data: null, error: null })
        nextChunk()
      } catch (error) {
        if (stopped) return
        worker?.terminate()
        if (workerRef.current === worker) workerRef.current = null
        setState({
          status: 'error', progress: 0, data: null,
          error: error instanceof Error ? error.message : 'Unable to analyze audio.',
        })
      } finally {
        if (context && context.state !== 'closed') {
          void context.close().catch(() => {})
        }
      }
    }

    void run()

    return () => {
      stopped = true
      worker?.terminate()
      if (workerRef.current === worker) workerRef.current = null
      if (context && context.state !== 'closed') {
        void context.close().catch(() => {})
      }
    }
  }, [file, cancelledFile])

  return { ...state, cancel }
}
