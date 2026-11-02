
import type { BrushStroke } from '../types/brush'

export function drawBrushStroke(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    const { points, color, size, opacity } = stroke
    if (points.length === 0) return

    ctx.save()

    ctx.globalCompositeOperation =
        stroke.mode === 'erase'
            ? 'destination-out'
            : 'source-over'

    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = stroke.mode === 'erase' ? 1 : opacity

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
    } else {
        ctx.moveTo(points[0].x, points[0].y)

        for (let i = 1; i < points.length - 1; i++) {
            const current = points[i]
            const next = points[i + 1]

            const midX = (current.x + next.x) / 2
            const midY = (current.y + next.y) / 2

            ctx.quadraticCurveTo(
                current.x,
                current.y,
                midX,
                midY,
            )
        }

        const last = points[points.length - 1]

        ctx.lineTo(last.x, last.y)
        ctx.stroke()
    }

    ctx.restore()
}
