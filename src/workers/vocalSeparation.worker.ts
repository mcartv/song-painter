
import separate from '@audio/neural-separate'

type StartMessage = {
    type: 'start'
    left: Float32Array
    right: Float32Array
    sampleRate: number
}

type WorkerResponse =
    | {
        type: 'progress'
        progress: number
    }
    | {
        type: 'complete'
        levels: Float32Array
        framesPerSecond: number
    }
    | {
        type: 'error'
        message: string
    }

const FPS = 50

// SONG_PAINTER_PITCH_V4: pitch is measured only from the separated vocal stem.
// 0 = unvoiced / pitch not confidently detected.
const PITCH_MIN_HZ = 90
const PITCH_MAX_HZ = 900
function report(message: WorkerResponse) {
    self.postMessage(message)
}

function createTimeline(
    channels: Float32Array[],
    sampleRate: number,
): Float32Array {
    const samplesPerFrame = Math.max(
        1,
        Math.round(sampleRate / FPS),
    )

    const length = Math.max(
        0,
        ...channels.map((channel) => channel.length),
    )

    const frameCount = Math.ceil(
        length / samplesPerFrame,
    )

    const levels = new Float32Array(frameCount)

    for (let frame = 0; frame < frameCount; frame++) {
        const from = frame * samplesPerFrame
        const to = Math.min(
            length,
            from + samplesPerFrame,
        )

        let sum = 0
        let count = 0

        for (const channel of channels) {
            const end = Math.min(to, channel.length)

            for (let i = from; i < end; i++) {
                const value = channel[i]
                sum += value * value
                count++
            }
        }

        levels[frame] =
            count > 0 ? Math.sqrt(sum / count) : 0
    }

    if (levels.length === 0) {
        return levels
    }

    const sorted = Float32Array.from(levels)
    sorted.sort()

    const lowIndex = Math.floor(
        (sorted.length - 1) * 0.2,
    )

    const highIndex = Math.floor(
        (sorted.length - 1) * 0.95,
    )

    const floor = sorted[lowIndex]
    const peak = sorted[highIndex]

    if (peak < 0.0001) {
        levels.fill(0)
        return levels
    }

    const range = Math.max(
        0.00001,
        peak - floor,
    )

    for (let i = 0; i < levels.length; i++) {
        levels[i] = Math.max(
            0,
            Math.min(
                1,
                (levels[i] - floor) / range,
            ),
        )
    }

    return levels
}

// SONG_PAINTER_PITCH_V4: simplified YIN difference estimator at 25 fps.
// It runs inside the existing Web Worker, never in the UI render loop.
// Pitch is a best-effort estimate, not a guaranteed melody transcription.
function createPitchTimeline(
  channels: Float32Array[],
  sampleRate: number,
  levels: Float32Array,
): Float32Array {
  const pitches = new Float32Array(levels.length)
  if (!channels.length || !levels.length || sampleRate <= 0) return pitches

  const hop = Math.max(1, Math.floor(sampleRate / FPS))
  const downsample = Math.max(1, Math.round(sampleRate / 11025))
  const rate = sampleRate / downsample
  const lowLag = Math.max(2, Math.floor(rate / PITCH_MAX_HZ))
  const highLag = Math.min(150, Math.ceil(rate / PITCH_MIN_HZ))
  const windowSize = 768
  const maxFrame = Math.max(0, channels[0].length - (windowSize + highLag) * downsample)
  const difference = new Float32Array(highLag + 1)
  let lastMidi = 0

  // Every other RMS frame (25 Hz), copied into the adjacent frame.
  for (let frame = 0; frame < levels.length; frame += 2) {
    if (levels[frame] < 0.16) { lastMidi = 0; continue }
    const center = Math.min(maxFrame, frame * hop)
    difference.fill(0)
    let baseEnergy = 0
    for (let j = 0; j < windowSize; j++) {
      const i = center + j * downsample
      let sample = 0
      for (let c = 0; c < channels.length; c++) {
        sample += channels[c][i] || 0
      }
      sample /= channels.length
      baseEnergy += sample * sample
    }
    if (baseEnergy / windowSize < 0.0000003) { lastMidi = 0; continue }

    let cumulative = 0
    let bestLag = 0
    let bestScore = 1
    for (let lag = 1; lag <= highLag; lag++) {
      let sum = 0
      for (let j = 0; j < windowSize; j++) {
        const aIndex = center + j * downsample
        const bIndex = aIndex + lag * downsample
        let a = 0
        let b = 0
        for (let c = 0; c < channels.length; c++) {
          a += channels[c][aIndex] || 0
          b += channels[c][bIndex] || 0
        }
        a /= channels.length
        b /= channels.length
        const d = a - b
        sum += d * d
      }
      difference[lag] = sum
      cumulative += sum
      if (lag < lowLag) continue
      const score = cumulative > 0 ? sum * lag / cumulative : 1
      if (score < bestScore) { bestScore = score; bestLag = lag }
      // YIN uses the first strong periodicity minimum, not just the deepest.
      if (score < 0.12 && lag > lowLag && score <= difference[lag - 1] * lag / Math.max(0.00001, cumulative)) break
    }

    if (bestLag === 0 || bestScore > 0.19) { lastMidi = 0; continue }
    const hz = rate / bestLag
    const midi = 69 + 12 * Math.log2(hz / 440)
    if (!Number.isFinite(midi) || midi < 29 || midi > 90) {
      lastMidi = 0
      continue
    }
    // Avoid implausible jumps from harmonics/octave ambiguity.
    const stable = lastMidi > 0 && Math.abs(midi - lastMidi) > 8 ? 0 : midi
    pitches[frame] = stable
    if (frame + 1 < pitches.length) pitches[frame + 1] = stable
    lastMidi = stable || 0
  }
  return pitches
}

// SONG_PAINTER_EXPRESSION_V5: accompaniment-energy estimate. When stems are aligned,
// subtract separated vocals from the original mix; otherwise use mix energy.
// Not a melody/pitch transcription of the instrumental track.
function createMusicTimeline(
  original: Float32Array[],
  vocals: Float32Array[],
  sampleRate: number,
  separatedRate: number,
): Float32Array {
  const aligned = sampleRate === separatedRate &&
    vocals.length > 0 && original.length > 0 &&
    Math.abs(vocals[0].length - original[0].length) < sampleRate * 0.05
  if (!aligned) return createTimeline(original, sampleRate)
  const channels = original.map((channel, c) => {
    const vocal = vocals[Math.min(c, vocals.length - 1)]
    const remaining = new Float32Array(channel.length)
    for (let i = 0; i < channel.length; i++) {
      remaining[i] = channel[i] - (vocal[i] || 0)
    }
    return remaining
  })
  return createTimeline(channels, sampleRate)
}

self.onmessage = async (
    event: MessageEvent<StartMessage>,
) => {
    if (event.data.type !== 'start') return

    const { left, right, sampleRate } = event.data

    try {
        report({
            type: 'progress',
            progress: 0,
        })

        const result = await separate(
            [left, right],
            {
                sampleRate,
                model: 'scnet',
                targets: ['vocals'],
                device: 'wasm',

                wasmPaths: {
                    'ort-wasm-simd-threaded.wasm':
                        `${self.location.origin}/ort/ort-wasm-simd-threaded.wasm`,
                },

                progress: ({ chunk, totalChunks }) => {
                    const percent =
                        totalChunks > 0
                            ? Math.round(
                                (chunk / totalChunks) * 100,
                            )
                            : 0

                    report({
                        type: 'progress',
                        progress: Math.max(
                            0,
                            Math.min(100, percent),
                        ),
                    })
                },
            },
        )

        const vocals = result.stems.vocals

        if (!vocals || vocals.length === 0) {
            throw new Error(
                'The separator returned no vocal track.',
            )
        }

        const levels = createTimeline(
            vocals,
            result.sampleRate,
        )

        const pitches = createPitchTimeline(
            vocals,
            result.sampleRate,
            levels,
        )


        
        const musicLevels = createMusicTimeline(
          [left, right], vocals, sampleRate, result.sampleRate,
        )

        self.postMessage(
            {
                type: 'complete',
                levels,
                framesPerSecond: FPS,
                pitches,
                musicLevels,
            },
            {
                transfer: [levels.buffer as ArrayBuffer, pitches.buffer as ArrayBuffer, musicLevels.buffer as ArrayBuffer],
            },
        )

    } catch (error) {
        report({
            type: 'error',
            message:
                error instanceof Error
                    ? error.message
                    : 'Vocal separation failed.',
        })
    }
}

export { }
