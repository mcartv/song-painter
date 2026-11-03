
import { useEffect, useState } from 'react'

import separate from '@audio/neural-separate'

export interface VocalAnalysis {
    levels: Float32Array
    framesPerSecond: number
}

type AnalysisStatus =
    | 'idle'
    | 'loading'
    | 'processing'
    | 'ready'
    | 'error'

interface AnalysisState {
    status: AnalysisStatus
    progress: number
    data: VocalAnalysis | null
    error: string | null
}

const EMPTY: AnalysisState = {
    status: 'idle',
    progress: 0,
    data: null,
    error: null,
}

function createVocalTimeline(
    channels: Float32Array[],
    sampleRate: number,
): VocalAnalysis {
    const fps = 50
    const samplesPerFrame = Math.round(sampleRate / fps)
    const length = Math.max(
        ...channels.map((channel) => channel.length),
    )

    const frameCount = Math.ceil(length / samplesPerFrame)
    const raw = new Float32Array(frameCount)

    for (let frame = 0; frame < frameCount; frame++) {
        const from = frame * samplesPerFrame
        const to = Math.min(length, from + samplesPerFrame)

        let sum = 0
        let count = 0

        for (const channel of channels) {
            for (let i = from; i < to && i < channel.length; i++) {
                sum += channel[i] * channel[i]
                count++
            }
        }

        raw[frame] = count > 0
            ? Math.sqrt(sum / count)
            : 0
    }

    // Normalize against a high percentile, not one extreme peak.
    const sorted = Array.from(raw).sort((a, b) => a - b)
    const peak = sorted[
        Math.floor((sorted.length - 1) * 0.95)
    ] ?? 0

    const floor = sorted[
        Math.floor((sorted.length - 1) * 0.2)
    ] ?? 0

    const levels = new Float32Array(frameCount)
    const range = Math.max(0.00001, peak - floor)

    for (let i = 0; i < frameCount; i++) {
        levels[i] = Math.max(
            0,
            Math.min(1, (raw[i] - floor) / range),
        )
    }

    return {
        levels,
        framesPerSecond: fps,
    }
}

export function useVocalAnalysis(file: File | null) {
    const [state, setState] = useState<AnalysisState>(EMPTY)

    useEffect(() => {
        let cancelled = false

        if (!file) {
            setState(EMPTY)
            return
        }

        setState({
            status: 'loading',
            progress: 0,
            data: null,
            error: null,
        })

        const analyze = async () => {
            let context: AudioContext | null = null

            try {
                context = new AudioContext()

                const bytes = await file.arrayBuffer()
                const decoded = await context.decodeAudioData(bytes)

                if (cancelled) return

                setState({
                    status: 'processing',
                    progress: 0,
                    data: null,
                    error: null,
                })

                const left = decoded.getChannelData(0).slice()

                const right = decoded.numberOfChannels > 1
                    ? decoded.getChannelData(1).slice()
                    : left.slice()


                const result = await separate(
                    [left, right],
                    {
                        sampleRate: decoded.sampleRate,
                        model: 'scnet',
                        targets: ['vocals'],

                        device: 'wasm',

                        progress: ({ chunk, totalChunks }) => {
                            if (cancelled) return

                            setState((previous) => ({
                                ...previous,
                                progress:
                                    totalChunks > 0
                                        ? Math.round((chunk / totalChunks) * 100)
                                        : 0,
                            }))
                        },
                    },
                )

                if (cancelled) return

                const vocalChannels = result.stems.vocals

                if (!vocalChannels?.length) {
                    throw new Error('No vocal track was produced.')
                }

                const data = createVocalTimeline(
                    vocalChannels,
                    result.sampleRate,
                )

                setState({
                    status: 'ready',
                    progress: 100,
                    data,
                    error: null,
                })
            } catch (error) {
                if (cancelled) return

                setState({
                    status: 'error',
                    progress: 0,
                    data: null,
                    error: error instanceof Error
                        ? error.message
                        : 'Vocal analysis failed.',
                })
            } finally {
                if (context && context.state !== 'closed') {
                    void context.close()
                }
            }
        }

        void analyze()

        return () => {
            cancelled = true
        }
    }, [file])

    return state
}
