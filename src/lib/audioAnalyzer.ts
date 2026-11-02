
export interface AudioFeatures {
    bass: number
    mid: number
    treble: number
    energy: number
}

export const SILENT_AUDIO: AudioFeatures = {
    bass: 0,
    mid: 0,
    treble: 0,
    energy: 0,
}

const clamp = (value: number) =>
    Math.max(0, Math.min(1, value))

export function analyzeAudio(
    analyser: AnalyserNode,
    data: Uint8Array<ArrayBuffer>,
): AudioFeatures {
    analyser.getByteFrequencyData(data)

    const sampleRate = analyser.context.sampleRate
    const binWidth = sampleRate / analyser.fftSize

    const averageRange = (startHz: number, endHz: number) => {
        const start = Math.max(0, Math.ceil(startHz / binWidth))
        const end = Math.min(
            data.length,
            Math.ceil(endHz / binWidth),
        )

        if (start >= end) return 0

        let sum = 0

        for (let i = start; i < end; i++) {
            sum += data[i]
        }

        return clamp(sum / ((end - start) * 255))
    }

    const bass = averageRange(20, 250)
    const mid = averageRange(250, 4000)
    const treble = averageRange(4000, 20000)
    const energy = averageRange(20, 20000)

    return { bass, mid, treble, energy }
}
