
import type { PaintMark } from './autoPainter'
import { renderMirroredArtwork } from './mirror'
import type { MirrorMode } from './mirror'

export function exportArtwork(
    marks: PaintMark[],
    width: number,
    height: number,
    mirror: MirrorMode = 'none',
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

    renderMirroredArtwork(
        ctx,
        canvas.width,
        canvas.height,
        marks,
    mirror,
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
