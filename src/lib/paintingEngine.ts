
import type { PaintingStyle } from '../types/studio'
import type { AudioFeatures } from './audioAnalyzer'

export interface RenderOptions {
    ctx: CanvasRenderingContext2D
    width: number
    height: number
    frame: number
    colors: string[]
    count: number
    intensity: number
    playing: boolean
    audio: AudioFeatures
}

interface Particle {
    x: number
    y: number
    orbit: number
    time: number
    color: string
    index: number
}

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value))

function makeParticle(
    options: RenderOptions,
    index: number,
): Particle {
    const {
        width,
        height,
        frame,
        count,
        colors,
        intensity,
        audio,
    } = options

    const sensitivity = intensity / 65
    const bass = audio.bass * sensitivity
    const mid = audio.mid * sensitivity
    const energy = audio.energy * sensitivity

    const power = 0.75 + bass * 2 + energy * 0.5
    const motion = 0.5 + mid * 2.5

    const seed = index * 2.399963229728653
    const orbit = Math.sqrt((index + 0.5) / count)
    const time = frame * 0.006 * motion + seed

    const angle =
        seed * 2.1 +
        frame * 0.002 * motion * ((index % 3) - 1)

    const spread =
        Math.min(width, height) *
        (0.09 + orbit * 0.32 * power)

    return {
        x:
            width * 0.5 +
            Math.cos(angle) * spread +
            Math.sin(time) * 16 * motion,
        y:
            height * 0.5 +
            Math.sin(angle) * spread * 0.66 +
            Math.cos(time * 1.2) * 22 * motion,
        orbit,
        time,
        color: colors[index % colors.length],
        index,
    }
}

function drawBloom(options: RenderOptions) {
    const { ctx, audio, intensity, count, playing } = options

    const sensitivity = intensity / 65
    const power =
        0.75 +
        audio.bass * sensitivity * 2 +
        audio.energy * sensitivity * 0.5

    const detail =
        0.6 + audio.treble * sensitivity * 2.5

    for (let i = 0; i < count; i++) {
        const p = makeParticle(options, i)

        const radius = clamp(
            (1.5 + (i % 9) * 0.72) *
            power *
            (0.8 + detail * 0.2),
            0.1,
            40,
        )

        ctx.globalAlpha =
            (0.1 + (1 - p.orbit) * 0.47) *
            (playing ? 1 : 0.68)

        ctx.fillStyle = p.color
        ctx.shadowColor = p.color
        ctx.shadowBlur = 13 * detail

        ctx.beginPath()
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.shadowBlur = 0
}

function drawFlow(options: RenderOptions) {
    const { ctx, audio, intensity, count, playing } = options

    const sensitivity = intensity / 65
    const motion = 0.5 + audio.mid * sensitivity * 2.5
    const detail = 0.6 + audio.treble * sensitivity * 2.5

    for (let i = 0; i < count; i++) {
        const p = makeParticle(options, i)

        ctx.globalAlpha =
            (0.1 + (1 - p.orbit) * 0.47) *
            (playing ? 1 : 0.68)

        ctx.strokeStyle = p.color
        ctx.lineWidth = (1 + (i % 5) * 0.5) * detail

        ctx.beginPath()
        ctx.moveTo(p.x, p.y)

        ctx.bezierCurveTo(
            p.x + 35 * motion,
            p.y - 30,
            p.x - 24 * motion,
            p.y - 45,
            p.x + Math.sin(p.time) * 50 * motion,
            p.y - 50,
        )

        ctx.stroke()
    }
}

function drawPulse(options: RenderOptions) {
    const {
        ctx,
        width,
        height,
        audio,
        intensity,
        count,
        playing,
    } = options

    const sensitivity = intensity / 65

    const power =
        0.75 +
        audio.bass * sensitivity * 2 +
        audio.energy * sensitivity * 0.5

    const detail = 0.6 + audio.treble * sensitivity * 2.5

    for (let i = 0; i < count; i++) {
        const p = makeParticle(options, i)

        const radius = clamp(
            p.orbit * Math.min(width, height) * 0.36 * power +
            Math.sin(p.time) * 6,
            0.1,
            Math.max(width, height) * 2,
        )

        ctx.globalAlpha =
            (0.1 + (1 - p.orbit) * 0.47) *
            (playing ? 1 : 0.68)

        ctx.strokeStyle = p.color
        ctx.lineWidth = 1.2 * detail

        ctx.beginPath()
        ctx.arc(
            width * 0.5,
            height * 0.5,
            radius,
            0,
            Math.PI * 2,
        )
        ctx.stroke()
    }
}

export function renderPainting(
    style: PaintingStyle,
    options: RenderOptions,
) {
    const { ctx } = options

    ctx.save()
    ctx.globalCompositeOperation = 'screen'

    switch (style) {
        case 'Bloom':
            drawBloom(options)
            break

        case 'Flow':
            drawFlow(options)
            break

        case 'Pulse':
            drawPulse(options)
            break
    }

    ctx.restore()
}
