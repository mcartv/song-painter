
import type { BrushStroke } from '../types/brush'

export function drawBrushStroke(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    const { points, color, size, opacity } = stroke

    if (points.length === 0) return

    ctx.save()
    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.lineWidth = size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = opacity

    if (points.length === 1) {
        ctx.beginPath()
        ctx.arc(
            points[0].x,
            points[0].y,
            size / 2,
            0,
            Math.PI * 2,
        )
        ctx.fill()
    } else {
        ctx.beginPath()
        ctx.moveTo(points[0].x, points[0].y)

        for (let i = 1; i < points.length; i++) {
            const point = points[i]
            ctx.lineTo(point.x, point.y)
        }

        ctx.stroke()
    }

    ctx.restore()
}
