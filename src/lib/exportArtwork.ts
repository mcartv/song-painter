
import type { PaintMark } from './autoPainter'
import { renderAutoArtwork } from './autoPainter'

export function exportArtwork(
    marks: PaintMark[],
    width: number,
    height: number,
) {
    if (
        width <= 0 ||
        height <= 0 ||
        width > 8192 ||
        height > 8192
    ) {
        return
    }

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width)
    canvas.height = Math.round(height)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    renderAutoArtwork(
        ctx,
        canvas.width,
        canvas.height,
        marks,
    )

    canvas.toBlob((blob) => {
        if (!blob) return

        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')

        link.href = url
        link.download = `song-painter-${Date.now()}.png`

        document.body.appendChild(link)
        link.click()
        link.remove()

        window.setTimeout(() => {
            URL.revokeObjectURL(url)
        }, 1000)
    }, 'image/png')
}
