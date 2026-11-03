
import type { AudioFeatures } from './audioAnalyzer'

export type AutoBrush =
    | 'surprise'
    | 'block'
    | 'paint'
    | 'hair'
    | 'glow'

type MarkBrush = Exclude<AutoBrush, 'surprise'>

export interface PaintMark {
    brush: MarkBrush
    x: number
    y: number
    endX: number
    endY: number
    size: number
    color: string
    opacity: number
    seed: number
}

export interface PaintDirector {
    marks: PaintMark[]
    elapsed: number
    accumulator: number
    focalX: number
    focalY: number
    targetX: number
    targetY: number
    nextFocalAt: number
}

const clamp = (n: number, a: number, b: number) =>
    Math.max(a, Math.min(b, n))

const random = (a: number, b: number) =>
    a + Math.random() * (b - a)

const seeded = (seed: number) => {
    const x = Math.sin(seed * 127.1 + 78.233) * 43758.5453
    return x - Math.floor(x)
}

export function createPaintDirector(): PaintDirector {
    return {
        marks: [],
        elapsed: 0,
        accumulator: 0,
        focalX: 0.5,
        focalY: 0.5,
        targetX: random(0.25, 0.75),
        targetY: random(0.25, 0.75),
        nextFocalAt: 0,
    }
}

function chooseBrush(
    selected: AutoBrush,
    audio: AudioFeatures,
): MarkBrush {
    if (selected !== 'surprise') return selected

    const roll = Math.random()

    if (audio.bass > 0.3 && roll < 0.35) {
        return 'block'
    }

    if (audio.treble > 0.25 && roll < 0.4) {
        return 'hair'
    }

    if (roll < 0.38) return 'paint'
    if (roll < 0.62) return 'hair'
    if (roll < 0.82) return 'glow'
    return 'block'
}

export function advancePaintDirector(
    director: PaintDirector,
    deltaMs: number,
    audio: AudioFeatures,
    brush: AutoBrush,
    colors: string[],
    intensity: number,
    density: number,
): PaintMark[] {
    if (!colors.length || director.marks.length >= 4500) {
        return []
    }

    const dt = clamp(deltaMs, 0, 100)
    director.elapsed += dt

    // Move the composition's focal area gradually.
    if (director.elapsed >= director.nextFocalAt) {
        director.targetX = random(0.2, 0.8)
        director.targetY = random(0.18, 0.82)
        director.nextFocalAt =
            director.elapsed + random(3500, 8500)
    }

    const drift = 1 - Math.exp(-dt / 3000)

    director.focalX +=
        (director.targetX - director.focalX) * drift

    director.focalY +=
        (director.targetY - director.focalY) * drift

    const soundStrength = clamp(
        audio.energy * 2.8 +
        audio.mid * 0.7 +
        audio.bass * 0.35,
        0,
        1,
    )

    // Quiet sections paint sparsely; energetic ones build layers.
    const interval = clamp(
        440 -
        density * 2.3 -
        soundStrength * 180,
        65,
        500,
    )

    director.accumulator = Math.min(
        director.accumulator + dt,
        interval * 3,
    )

    const created: PaintMark[] = []

    while (
        director.accumulator >= interval &&
        created.length < 3 &&
        director.marks.length < 4500
    ) {
        director.accumulator -= interval

        // Leave more empty space in quiet passages.
        if (
            audio.energy < 0.012 &&
            Math.random() < 0.8
        ) {
            continue
        }

        const kind = chooseBrush(brush, audio)

        // Most marks gather around the focal area.
        // Some break away to create tension and contrast.
        const distant = Math.random() < 0.16

        const spread =
            0.055 + (1 - soundStrength) * 0.12

        const x = distant
            ? random(0.08, 0.92)
            : clamp(
                director.focalX +
                random(-spread, spread),
                0.04,
                0.96,
            )

        const y = distant
            ? random(0.08, 0.92)
            : clamp(
                director.focalY +
                random(-spread, spread),
                0.04,
                0.96,
            )

        const angle =
            director.elapsed * 0.00017 +
            audio.mid * Math.PI * 3 +
            random(-1.4, 1.4)

        const length =
            0.025 +
            soundStrength * 0.16 +
            random(0.005, 0.09)

        const endX = clamp(
            x + Math.cos(angle) * length,
            0.02,
            0.98,
        )

        const endY = clamp(
            y + Math.sin(angle) * length,
            0.02,
            0.98,
        )

        const size = clamp(
            (0.007 + audio.bass * 0.055) *
            (0.5 + intensity / 100),
            0.004,
            0.1,
        )

        const mark: PaintMark = {
            brush: kind,
            x,
            y,
            endX,
            endY,
            size,
            color:
                colors[Math.floor(Math.random() * colors.length)],
            opacity: random(0.35, 0.85),
            seed: Math.random() * 10000,
        }

        director.marks.push(mark)
        created.push(mark)
    }

    return created
}

export function drawArtworkBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
) {
    ctx.save()

    const gradient = ctx.createRadialGradient(
        width * 0.43,
        height * 0.4,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8,
    )

    gradient.addColorStop(0, '#211c29')
    gradient.addColorStop(0.55, '#15121b')
    gradient.addColorStop(1, '#0e0c13')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
}

export function drawPaintMark(
    ctx: CanvasRenderingContext2D,
    mark: PaintMark,
    width: number,
    height: number,
) {
    const unit = Math.min(width, height)

    const x1 = mark.x * width
    const y1 = mark.y * height
    const x2 = mark.endX * width
    const y2 = mark.endY * height
    const size = mark.size * unit

    const dx = x2 - x1
    const dy = y2 - y1
    const angle = Math.atan2(dy, dx)
    const distance = Math.hypot(dx, dy)

    ctx.save()
    ctx.strokeStyle = mark.color
    ctx.fillStyle = mark.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = mark.opacity

    const curve = (offset = 0) => {
        ctx.beginPath()
        ctx.moveTo(
            x1 - Math.sin(angle) * offset,
            y1 + Math.cos(angle) * offset,
        )
        ctx.quadraticCurveTo(
            (x1 + x2) / 2 -
            Math.sin(angle) * (offset + size * 1.5),
            (y1 + y2) / 2 +
            Math.cos(angle) * (offset + size * 1.5),
            x2 - Math.sin(angle) * offset,
            y2 + Math.cos(angle) * offset,
        )
        ctx.stroke()
    }

    switch (mark.brush) {
        case 'block': {
            ctx.translate(x1, y1)
            ctx.rotate(angle)
            ctx.globalAlpha = mark.opacity * 0.75
            ctx.fillRect(
                -size * 0.3,
                -size * 1.2,
                Math.max(size * 1.8, distance),
                size * 2.4,
            )
            break
        }

        case 'paint': {
            ctx.lineWidth = size * 2.4
            ctx.globalAlpha = mark.opacity * 0.55
            curve()

            // Small bristles add a painterly texture.
            for (let i = 0; i < 9; i++) {
                const variation =
                    seeded(mark.seed + i * 7) - 0.5

                ctx.lineWidth =
                    Math.max(0.6, size * randomFree(mark.seed, i))

                ctx.globalAlpha =
                    mark.opacity * (0.2 + i * 0.035)

                curve(variation * size * 2.3)
            }
            break
        }

        case 'hair': {
            for (let i = 0; i < 8; i++) {
                const variation =
                    seeded(mark.seed + i * 13) - 0.5

                ctx.globalAlpha =
                    mark.opacity * (0.25 + i * 0.06)

                ctx.lineWidth =
                    Math.max(0.45, size * 0.025)

                curve(variation * size * 2.8)
            }
            break
        }

        case 'glow': {
            ctx.shadowColor = mark.color
            ctx.shadowBlur = size * 4
            ctx.globalAlpha = mark.opacity * 0.45
            ctx.lineWidth = size * 2.2
            curve()

            ctx.shadowBlur = size
            ctx.globalAlpha = mark.opacity
            ctx.lineWidth = size * 0.6
            curve()
            break
        }
    }

    ctx.restore()
}

function randomFree(seed: number, index: number) {
    return 0.06 + seeded(seed + index * 19) * 0.22
}

export function renderAutoArtwork(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    marks: PaintMark[],
) {
    drawArtworkBackground(ctx, width, height)

    for (const mark of marks) {
        drawPaintMark(ctx, mark, width, height)
    }
}
