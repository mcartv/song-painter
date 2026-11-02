
import type { BrushStroke } from '../types/brush'

function drawSmoothPath(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    const { points, size } = stroke

    if (points.length === 0) return

    ctx.beginPath()

    if (points.length === 1) {
        ctx.arc(
            points[0].x,
            points[0].y,
            size / 2,
            0,
            Math.PI * 2,
        )
        ctx.fill()
        return
    }

    ctx.moveTo(points[0].x, points[0].y)

    for (let i = 1; i < points.length - 1; i++) {
        const current = points[i]
        const next = points[i + 1]

        ctx.quadraticCurveTo(
            current.x,
            current.y,
            (current.x + next.x) / 2,
            (current.y + next.y) / 2,
        )
    }

    const last = points[points.length - 1]
    ctx.lineTo(last.x, last.y)
    ctx.stroke()
}

function drawGlow(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    ctx.save()

    ctx.shadowColor = stroke.color
    ctx.shadowBlur = stroke.size * 1.8
    ctx.lineWidth = stroke.size * 1.3
    ctx.globalAlpha = stroke.opacity * 0.55

    drawSmoothPath(ctx, stroke)

    ctx.shadowBlur = stroke.size * 0.45
    ctx.lineWidth = stroke.size * 0.55
    ctx.globalAlpha = stroke.opacity

    drawSmoothPath(ctx, stroke)

    ctx.restore()
}

function drawInk(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    ctx.lineWidth = stroke.size
    drawSmoothPath(ctx, stroke)
}

function drawParticles(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    const points = stroke.points
    if (!points.length) return

    // Deterministic placement keeps re-renders and HD export consistent.
    const stamp = (x: number, y: number, index: number) => {
        for (let j = 0; j < 5; j++) {
            const seed = index * 17.13 + j * 39.71 + stroke.id

            const angle = seed * 2.399963
            const spread =
                (0.25 + (Math.sin(seed * 1.73) + 1) * 0.375) *
                stroke.size

            const radius =
                Math.max(
                    0.35,
                    stroke.size *
                    (0.035 + (Math.cos(seed * 2.11) + 1) * 0.045),
                )

            const px = x + Math.cos(angle) * spread
            const py = y + Math.sin(angle) * spread

            ctx.beginPath()
            ctx.arc(px, py, radius, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    let last = points[0]
    let traveled = 0
    let stampIndex = 0

    stamp(last.x, last.y, stampIndex++)

    const spacing = Math.max(2, stroke.size * 0.35)

    for (let i = 1; i < points.length; i++) {
        const point = points[i]
        const dx = point.x - last.x
        const dy = point.y - last.y
        const length = Math.hypot(dx, dy)

        if (length === 0) continue

        const steps = Math.max(1, Math.ceil(length / spacing))

        for (let step = 1; step <= steps; step++) {
            const progress = step / steps
            traveled += length / steps

            if (traveled >= spacing) {
                stamp(
                    last.x + dx * progress,
                    last.y + dy * progress,
                    stampIndex++,
                )
                traveled -= spacing
            }
        }

        last = point
    }
}

export function drawBrushStroke(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    if (!stroke.points.length) return

    ctx.save()

    ctx.globalCompositeOperation =
        stroke.mode === 'erase'
            ? 'destination-out'
            : 'source-over'

    ctx.strokeStyle = stroke.color
    ctx.fillStyle = stroke.color
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = stroke.size
    ctx.globalAlpha =
        stroke.mode === 'erase' ? 1 : stroke.opacity

    if (stroke.mode === 'erase') {
        drawSmoothPath(ctx, stroke)
    } else {
        switch (stroke.preset ?? 'ink') {
            case 'glow':
                drawGlow(ctx, stroke)
                break

            case 'particles':
                drawParticles(ctx, stroke)
                break

            case 'ink':
                drawInk(ctx, stroke)
                break
        }
    }

    ctx.restore()
}
