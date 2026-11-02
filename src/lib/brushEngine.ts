
import type { BrushStroke } from '../types/brush'

export function drawBrushStroke(
    ctx: CanvasRenderingContext2D,
    stroke: BrushStroke,
) {
    const { points, color, size, opacity } = stroke
    if (!points.length) return

    ctx.save()

    ctx.globalCompositeOperation =
        stroke.mode === 'erase' ? 'destination-out' : 'source-over'

    ctx.strokeStyle = color
    ctx.fillStyle = color
    ctx.globalAlpha = stroke.mode === 'erase' ? 1 : opacity
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineWidth = size

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
            ctx.lineTo(points[i].x, points[i].y)
        }

        ctx.stroke()
    }

    ctx.restore()
}
