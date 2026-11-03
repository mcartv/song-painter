import type { PaintingStyle } from '../types/studio'
import type { BrushStroke } from '../types/brush'
import type { AudioFeatures } from './audioAnalyzer'

import { palettes } from './palettes'
import { renderPainting } from './paintingEngine'
import { drawBrushStroke } from './brushEngine'

interface ExportOptions {
    width: number
    height: number
    scale?: number
    style: PaintingStyle
    palette: number
    intensity: number
    density: number
    playing: boolean
    frame: number
    audio: AudioFeatures
    strokes: BrushStroke[]
    blankCanvas?: boolean
}

export function exportArtwork(options: ExportOptions) {
    const {
        width,
        height,
        style,
        palette,
        intensity,
        density,
        playing,
        frame,
        audio,
        strokes,
        blankCanvas,
    } = options

    if (width <= 0 || height <= 0) return

    const scale = Math.min(
        options.scale ?? 2,
        4096 / Math.max(width, height),
    )

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(scale, 0, 0, scale, 0, 0)

    ctx.fillStyle = '#111016'
    ctx.fillRect(0, 0, width, height)

    const bg = ctx.createRadialGradient(
        width * 0.5,
        height * 0.48,
        2,
        width * 0.5,
        height * 0.48,
        Math.max(width, height) * 0.57,
    )

    bg.addColorStop(0, '#262131')
    bg.addColorStop(0.6, '#17151f')
    bg.addColorStop(1, '#111016')

    ctx.fillStyle = bg
    ctx.fillRect(0, 0, width, height)

    if (!blankCanvas) {
        renderPainting(style, {
            ctx,
            width,
            height,
            frame,
            colors: palettes[palette].colors,
            count: Math.round(85 + density * 2.5),
            intensity,
            playing,
            audio,
        })
    }

    const layer = document.createElement('canvas')
    layer.width = canvas.width
    layer.height = canvas.height

    const layerCtx = layer.getContext('2d')

    if (layerCtx) {
        layerCtx.setTransform(scale, 0, 0, scale, 0, 0)

        for (const stroke of strokes) {
            drawBrushStroke(layerCtx, stroke)
        }

        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.drawImage(layer, 0, 0)
        ctx.restore()
    }

    canvas.toBlob((blob) => {
        if (!blob) return

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = `song-painter-${Date.now()}.png`

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
    }, 'image/png')
}