
export type AutoBrush =
    | 'surprise'
    | 'block'
    | 'paint'
    | 'hair'
    | 'glow'

type StrokeBrush = Exclude<AutoBrush, 'surprise'>

export interface PaintPoint {
    x: number
    y: number
    pressure: number
}

export interface PaintMark {
    id: number
    brush: StrokeBrush
    points: PaintPoint[]
    size: number
    color: string
    opacity: number
    seed: number
}

export interface PaintDirector {
    marks: PaintMark[]
    active: PaintMark | null
    elapsed: number
    voiceTime: number
    quietTime: number
    x: number
    y: number
    heading: number
    nextId: number
}

export interface StrokeUpdate {
    segments: Array<{ mark: PaintMark; index: number }>
    started: boolean
    finished: boolean
}

const clamp = (x: number, min: number, max: number) =>
    Math.max(min, Math.min(max, x))

const random = (min: number, max: number) =>
    min + Math.random() * (max - min)

const seeded = (x: number) => {
    const n = Math.sin(x * 127.1 + 78.233) * 43758.5453
    return n - Math.floor(n)
}

export function createPaintDirector(): PaintDirector {
    return {
        marks: [],
        active: null,
        elapsed: 0,
        voiceTime: 0,
        quietTime: 0,
        x: 0.5,
        y: 0.5,
        heading: 0,
        nextId: 1,
    }
}

function pickBrush(selected: AutoBrush): StrokeBrush {
    if (selected !== 'surprise') return selected

    const choices: StrokeBrush[] = [
        'paint', 'paint', 'hair', 'hair', 'glow', 'block',
    ]

    return choices[Math.floor(Math.random() * choices.length)]
}

export function advanceVocalPainter(
    director: PaintDirector,
    dtMs: number,
    vocalLevel: number,
    brush: AutoBrush,
    colors: string[],
    intensity: number,
    sensitivity: number,
): StrokeUpdate {
    const result: StrokeUpdate = {
        segments: [],
        started: false,
        finished: false,
    }

    if (!colors.length || director.marks.length >= 2000) {
        return result
    }

    const dt = clamp(dtMs, 0, 80)
    director.elapsed += dt

    const threshold = 0.10 +
        (100 - clamp(sensitivity, 0, 100)) * 0.004

    const vocalActive = vocalLevel >= threshold

    if (!vocalActive) {
        director.voiceTime = 0
        director.quietTime += dt

        if (director.active && director.quietTime > 220) {
            director.active = null
            result.finished = true
        }

        return result
    }

    director.quietTime = 0
    director.voiceTime += dt

    if (!director.active && director.voiceTime < 100) {
        return result
    }

    if (!director.active) {
        director.x = random(0.18, 0.82)
        director.y = random(0.18, 0.82)
        director.heading = random(-Math.PI, Math.PI)

        const id = director.nextId++

        const mark: PaintMark = {
            id,
            brush: pickBrush(brush),
            points: [{
                x: director.x,
                y: director.y,
                pressure: 0.4,
            }],
            size: 0.008 + (intensity / 100) * 0.023,
            color: colors[Math.floor(Math.random() * colors.length)],
            opacity: random(0.62, 0.9),
            seed: random(0, 10000),
        }

        director.marks.push(mark)
        director.active = mark
        result.started = true
    }

    const mark = director.active
    if (!mark) return result

    const strength = clamp(
        (vocalLevel - threshold) / Math.max(0.01, 1 - threshold),
        0,
        1,
    )

    // An ongoing phrase means ongoing physical movement.
    const speed = 0.10 + strength * 0.18
    const distance = speed * dt / 1000

    const wave =
        Math.sin(director.elapsed * 0.0017 + mark.seed) * 0.8 +
        Math.sin(director.elapsed * 0.003 + mark.seed) * 0.25

    director.heading += wave * dt * 0.00065

    let nx = director.x + Math.cos(director.heading) * distance
    let ny = director.y + Math.sin(director.heading) * distance

    // Turn back toward the painting if we approach the edge.
    if (nx < 0.06 || nx > 0.94 || ny < 0.06 || ny > 0.94) {
        director.heading = Math.atan2(
            0.5 - director.y,
            0.5 - director.x,
        )

        nx = director.x + Math.cos(director.heading) * distance
        ny = director.y + Math.sin(director.heading) * distance
    }

    director.x = clamp(nx, 0.04, 0.96)
    director.y = clamp(ny, 0.04, 0.96)

    const previous = mark.points[mark.points.length - 1]
    const pressure = previous.pressure +
        (0.25 + strength * 0.75 - previous.pressure) * 0.16

    const point: PaintPoint = {
        x: director.x,
        y: director.y,
        pressure,
    }

    if (
        Math.hypot(
            point.x - previous.x,
            point.y - previous.y,
        ) < 0.0001
    ) {
        return result
    }

    mark.points.push(point)

    result.segments.push({
        mark,
        index: mark.points.length - 1,
    })

    // Continue unusually long phrases as connected paths.
    if (mark.points.length >= 2500) {
        const continuation: PaintMark = {
            ...mark,
            id: director.nextId++,
            points: [{ ...point }],
        }

        director.marks.push(continuation)
        director.active = continuation
    }

    return result
}

export function drawArtworkBackground(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
) {
    ctx.save()

    const gradient = ctx.createRadialGradient(
        width * 0.45,
        height * 0.42,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.8,
    )

    gradient.addColorStop(0, '#24202c')
    gradient.addColorStop(0.55, '#17141e')
    gradient.addColorStop(1, '#0e0c13')

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)

    ctx.restore()
}

export function drawPaintSegment(
    ctx: CanvasRenderingContext2D,
    mark: PaintMark,
    index: number,
    width: number,
    height: number,
) {
    if (index < 1 || index >= mark.points.length) return

    const from = mark.points[index - 1]
    const to = mark.points[index]

    const x1 = from.x * width
    const y1 = from.y * height
    const x2 = to.x * width
    const y2 = to.y * height

    const dx = x2 - x1
    const dy = y2 - y1
    const length = Math.hypot(dx, dy)

    if (length < 0.001) return

    const nx = -dy / length
    const ny = dx / length

    const unit = Math.min(width, height)
    const pressure = (from.pressure + to.pressure) / 2
    const size = mark.size * unit * pressure

    ctx.save()

    ctx.globalAlpha = mark.opacity
    ctx.strokeStyle = mark.color
    ctx.fillStyle = mark.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    const line = (offset: number, thickness: number) => {
        ctx.lineWidth = Math.max(0.4, thickness)
        ctx.beginPath()
        ctx.moveTo(x1 + nx * offset, y1 + ny * offset)
        ctx.lineTo(x2 + nx * offset, y2 + ny * offset)
        ctx.stroke()
    }

    switch (mark.brush) {
        case 'block': {
            ctx.beginPath()
            ctx.moveTo(x1 + nx * size, y1 + ny * size)
            ctx.lineTo(x2 + nx * size, y2 + ny * size)
            ctx.lineTo(x2 - nx * size, y2 - ny * size)
            ctx.lineTo(x1 - nx * size, y1 - ny * size)
            ctx.closePath()
            ctx.fill()
            break
        }

        case 'paint': {
            ctx.globalAlpha = mark.opacity * 0.65
            line(0, size * 1.7)

            for (let i = 0; i < 10; i++) {
                const offset =
                    (seeded(mark.seed + i * 13) - 0.5) * size * 1.7

                ctx.globalAlpha =
                    mark.opacity * (0.2 + seeded(mark.seed + i) * 0.45)

                line(offset, size * 0.09)
            }
            break
        }

        case 'hair': {
            for (let i = 0; i < 7; i++) {
                const offset = (i - 3) * size * 0.25

                ctx.globalAlpha =
                    mark.opacity * (0.35 + seeded(mark.seed + i) * 0.5)

                line(offset, Math.max(0.4, size * 0.022))
            }
            break
        }

        case 'glow': {
            ctx.shadowColor = mark.color
            ctx.shadowBlur = size * 2

            ctx.globalAlpha = mark.opacity * 0.45
            line(0, size * 1.7)

            ctx.shadowBlur = size * 0.5
            ctx.globalAlpha = mark.opacity
            line(0, size * 0.45)
            break
        }
    }

    ctx.restore()
}

export function renderAutoArtwork(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    marks: PaintMark[],
) {
    drawArtworkBackground(ctx, width, height)

    for (const mark of marks) {
        for (let i = 1; i < mark.points.length; i++) {
            drawPaintSegment(ctx, mark, i, width, height)
        }
    }
}
