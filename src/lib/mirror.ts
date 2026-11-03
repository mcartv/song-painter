import type { PaintMark } from './autoPainter'
import { drawArtworkBackground, drawPaintSegment } from './autoPainter'

export type MirrorMode = 'none' | 'vertical' | 'horizontal' | 'quad'

export function drawMirroredSegment(
  ctx: CanvasRenderingContext2D,
  mark: PaintMark,
  index: number,
  width: number,
  height: number,
  mirror: MirrorMode,
) {
  const draw = (translateX: number, translateY: number, scaleX: number, scaleY: number) => {
    ctx.save()
    ctx.translate(translateX, translateY)
    ctx.scale(scaleX, scaleY)
    drawPaintSegment(ctx, mark, index, width, height)
    ctx.restore()
  }

  switch (mirror) {
    case 'vertical':
      // Original on left; reflected on right.
      draw(0, 0, 0.5, 1)
      draw(width, 0, -0.5, 1)
      break
    case 'horizontal':
      // Original on top; reflected below.
      draw(0, 0, 1, 0.5)
      draw(0, height, 1, -0.5)
      break
    case 'quad':
      draw(0, 0, 0.5, 0.5)
      draw(width, 0, -0.5, 0.5)
      draw(0, height, 0.5, -0.5)
      draw(width, height, -0.5, -0.5)
      break
    default:
      drawPaintSegment(ctx, mark, index, width, height)
  }
}

export function renderMirroredArtwork(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  marks: PaintMark[],
  mirror: MirrorMode,
) {
  drawArtworkBackground(ctx, width, height)
  for (const mark of marks) {
    for (let i = 1; i < mark.points.length; i++) {
      drawMirroredSegment(ctx, mark, i, width, height, mirror)
    }
  }
}
